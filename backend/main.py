import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import redis
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, Float, Integer, String, create_engine, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class SentimentHistory(Base):
    __tablename__ = "sentiment_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    panic_score: Mapped[float] = mapped_column(Float, nullable=False)
    top_headline: Mapped[str] = mapped_column(String(2000), nullable=False)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, default="ALL", server_default="ALL")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )


def ensure_history_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("sentiment_history")}
    except SQLAlchemyError:
        return

    if "ticker" in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE sentiment_history "
                "ADD COLUMN ticker VARCHAR(32) NOT NULL DEFAULT 'ALL'",
            ),
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_history_schema()
    yield


app = FastAPI(title="FinRadar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True,
)

FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news"
FINNHUB_COMPANY_NEWS_URL = "https://finnhub.io/api/v1/company-news"
HF_FINBERT_URL = "https://router.huggingface.co/hf-inference/models/ProsusAI/finbert"
HEADLINE_LIMIT = 10
HF_MAX_ATTEMPTS = 6
HF_RETRY_BASE_SEC = 5.0
CACHE_TTL_SECONDS = 900
COMPANY_NEWS_LOOKBACK_DAYS = 7
WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SentimentHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    panic_score: float
    top_headline: str
    ticker: str
    timestamp: datetime


class ScreenerItem(BaseModel):
    ticker: str
    panic_score: float | None
    top_headline: str


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"missing required environment variable: {name}")
    return value


def normalize_ticker(raw_ticker: str | None) -> str:
    candidate = (raw_ticker or "ALL").strip().upper()
    if not candidate:
        return "ALL"
    return candidate


def _cache_key_for_ticker(ticker: str) -> str:
    return f"current_sentiment:{ticker}"


def _extract_headlines_from_articles(articles: object) -> list[str]:
    if not isinstance(articles, list):
        raise ValueError("unexpected Finnhub response shape")

    headlines: list[str] = []
    for item in articles:
        if not isinstance(item, dict):
            continue
        headline = item.get("headline")
        if isinstance(headline, str) and headline.strip():
            headlines.append(headline.strip())
        if len(headlines) >= HEADLINE_LIMIT:
            break
    return headlines


def fetch_headlines(ticker: str) -> list[str]:
    token = _require_env("FINNHUB_API_KEY")
    if ticker == "ALL":
        response = requests.get(
            FINNHUB_NEWS_URL,
            params={"category": "general", "token": token},
            timeout=30,
        )
    else:
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=COMPANY_NEWS_LOOKBACK_DAYS)
        response = requests.get(
            FINNHUB_COMPANY_NEWS_URL,
            params={
                "symbol": ticker,
                "from": start_date.isoformat(),
                "to": end_date.isoformat(),
                "token": token,
            },
            timeout=30,
        )

    response.raise_for_status()
    headlines = _extract_headlines_from_articles(response.json())
    if not headlines:
        raise ValueError(f"no headlines returned from Finnhub for ticker {ticker}")
    return headlines


def _unwrap_classification(payload: object) -> list[dict]:
    if isinstance(payload, dict) and "error" in payload:
        raise ValueError(str(payload.get("error", "Hugging Face API error")))
    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, dict):
            return [x for x in payload if isinstance(x, dict)]
        if isinstance(first, list):
            return [x for x in first if isinstance(x, dict)]
    return []


def _label_bucket(label: str) -> str | None:
    lower = label.lower().strip()
    if lower in ("label_0", "0"):
        return "positive"
    if lower in ("label_1", "1"):
        return "negative"
    if lower in ("label_2", "2"):
        return "neutral"
    if "negative" in lower:
        return "negative"
    if "neutral" in lower:
        return "neutral"
    if "positive" in lower:
        return "positive"
    return None


def panic_score_from_finbert_probs(classification: list[dict]) -> float:
    probs = {"negative": 0.0, "neutral": 0.0, "positive": 0.0}
    for item in classification:
        label = str(item.get("label", ""))
        bucket = _label_bucket(label)
        if bucket is None:
            continue
        probs[bucket] = float(item.get("score", 0.0))
    total = probs["negative"] + probs["neutral"] + probs["positive"]
    if total <= 0:
        return 50.0
    neg = probs["negative"] / total
    neu = probs["neutral"] / total
    pos = probs["positive"] / total
    return 100.0 * neg + 50.0 * neu + 0.0 * pos


def score_headline_finbert(text: str, hf_token: str) -> float:
    truncated = text if len(text) <= 2000 else text[:2000]
    headers = {"Authorization": f"Bearer {hf_token}"}
    body = {
        "inputs": truncated,
        "parameters": {"return_all_scores": True},
    }
    last_error: str | None = None
    for attempt in range(HF_MAX_ATTEMPTS):
        response = requests.post(
            HF_FINBERT_URL,
            headers=headers,
            json=body,
            timeout=120,
        )
        if response.status_code == 503:
            last_error = response.text or "model is loading"
            wait = HF_RETRY_BASE_SEC * (attempt + 1)
            time.sleep(wait)
            continue
        if response.status_code >= 400:
            raise ValueError(
                f"Hugging Face API error {response.status_code}: {response.text}",
            )
        data = response.json()
        items = _unwrap_classification(data)
        if not items:
            raise ValueError(f"could not parse FinBERT response: {data!r}")
        return panic_score_from_finbert_probs(items)
    raise ValueError(f"FinBERT unavailable after retries: {last_error}")


def _write_sentiment_cache(payload: dict, ticker: str) -> None:
    try:
        redis_client.setex(_cache_key_for_ticker(ticker), CACHE_TTL_SECONDS, json.dumps(payload))
    except redis.RedisError:
        pass


def _read_sentiment_cache(ticker: str) -> dict | None:
    try:
        cached = redis_client.get(_cache_key_for_ticker(ticker))
    except redis.RedisError:
        return None
    if cached is None:
        return None
    try:
        payload = json.loads(cached)
        if not isinstance(payload, dict):
            return None
        return payload
    except json.JSONDecodeError:
        return None


def fetch_and_score_news(db: Session, ticker: str) -> dict:
    hf_token = _require_env("HUGGINGFACE_TOKEN")
    headlines = fetch_headlines(ticker)
    line_scores: list[float] = []
    for headline in headlines:
        line_scores.append(score_headline_finbert(headline, hf_token))
    panic_score = round(sum(line_scores) / len(line_scores), 2)
    recorded_at = datetime.now(timezone.utc)
    top_headline = headlines[0]
    if len(top_headline) > 2000:
        top_headline = top_headline[:2000]
    record = SentimentHistory(
        panic_score=panic_score,
        top_headline=top_headline,
        ticker=ticker,
        timestamp=recorded_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    payload = {
        "ticker": ticker,
        "panic_score": panic_score,
        "headlines": headlines,
        "top_headline": top_headline,
        "timestamp": recorded_at.timestamp(),
    }
    _write_sentiment_cache(payload, ticker)
    return payload


def _sentiment_fallback() -> dict:
    return {
        "ticker": "ALL",
        "panic_score": None,
        "headlines": [],
        "top_headline": "",
        "timestamp": None,
    }


def _sentiment_from_history(db: Session, ticker: str) -> dict | None:
    try:
        stmt = select(SentimentHistory)
        if ticker != "ALL":
            stmt = stmt.where(SentimentHistory.ticker == ticker)
        row = db.scalars(stmt.order_by(SentimentHistory.timestamp.desc())).first()
    except SQLAlchemyError:
        return None

    if row is None:
        return None

    return {
        "ticker": ticker,
        "panic_score": row.panic_score,
        "headlines": [row.top_headline] if row.top_headline else [],
        "top_headline": row.top_headline or "",
        "timestamp": row.timestamp.timestamp(),
    }


@app.get("/api/sentiment")
def get_sentiment(
    ticker: str = Query(default="ALL", description="Ticker symbol like TSLA, AAPL, or ALL for market-wide sentiment"),
    db: Session = Depends(get_db),
) -> dict:
    normalized_ticker = normalize_ticker(ticker)

    cached = _read_sentiment_cache(normalized_ticker)
    if cached is not None:
        return cached

    try:
        return fetch_and_score_news(db, normalized_ticker)
    except (requests.RequestException, ValueError, SQLAlchemyError):
        db.rollback()
        history_payload = _sentiment_from_history(db, normalized_ticker)
        if history_payload is not None:
            return history_payload
        fallback = _sentiment_fallback()
        fallback["ticker"] = normalized_ticker
        return fallback


@app.get("/api/screener", response_model=list[ScreenerItem])
def get_screener(db: Session = Depends(get_db)) -> list[ScreenerItem]:
    items: list[ScreenerItem] = []

    for ticker in WATCHLIST:
        normalized_ticker = normalize_ticker(ticker)
        cached = _read_sentiment_cache(normalized_ticker)
        if cached is None:
            try:
                cached = fetch_and_score_news(db, normalized_ticker)
            except (requests.RequestException, ValueError, SQLAlchemyError):
                db.rollback()
                cached = {
                    "ticker": normalized_ticker,
                    "panic_score": None,
                    "top_headline": "",
                    "headlines": [],
                    "timestamp": None,
                }

        items.append(
            ScreenerItem(
                ticker=normalized_ticker,
                panic_score=cached.get("panic_score"),
                top_headline=str(cached.get("top_headline", "")),
            ),
        )

    return items


@app.get("/api/history", response_model=list[SentimentHistoryRead])
def get_history(
    ticker: str = Query(default="ALL", description="Ticker symbol filter, or ALL for market-wide history"),
    db: Session = Depends(get_db),
):
    normalized_ticker = normalize_ticker(ticker)
    try:
        stmt = select(SentimentHistory)
        if normalized_ticker != "ALL":
            stmt = stmt.where(SentimentHistory.ticker == normalized_ticker)
        rows = db.scalars(stmt.order_by(SentimentHistory.timestamp.asc())).all()
        return list(rows)
    except SQLAlchemyError:
        return []
