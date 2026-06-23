import time
import requests
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from core.config import HUGGINGFACE_TOKEN, HF_FINBERT_URL, HF_MAX_ATTEMPTS, HF_RETRY_BASE_SEC
from services.finnhub_service import fetch_headlines
from services.cache_service import write_sentiment_cache
from models import SentimentHistory

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

def calculate_panic_score(classification: list[dict]) -> float:
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
        return calculate_panic_score(items)
    raise ValueError(f"FinBERT unavailable after retries: {last_error}")

def fetch_and_score_news(db: Session, ticker: str) -> dict:
    hf_token = HUGGINGFACE_TOKEN
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
    write_sentiment_cache(payload, ticker)
    return payload

def sentiment_fallback() -> dict:
    return {
        "ticker": "ALL",
        "panic_score": None,
        "headlines": [],
        "top_headline": "",
        "timestamp": None,
    }

def sentiment_from_history(db: Session, ticker: str) -> dict | None:
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

from models import SentimentSnapshot, SnapshotArticle, NewsArticle

def sentiment_from_snapshot(db: Session, ticker: str) -> dict | None:
    try:
        stmt = select(SentimentSnapshot)
        if ticker != "ALL":
            stmt = stmt.where(SentimentSnapshot.ticker == ticker)
        row = db.scalars(stmt.order_by(SentimentSnapshot.snapshot_time.desc())).first()
        
        if not row:
            return None
            
        articles = db.scalars(
            select(NewsArticle.headline)
            .join(SnapshotArticle, SnapshotArticle.article_id == NewsArticle.id)
            .where(SnapshotArticle.snapshot_id == row.id)
        ).all()
        
        return {
            "ticker": ticker,
            "panic_score": float(row.panic_score),
            "headlines": list(articles),
            "top_headline": articles[0] if articles else "",
            "timestamp": row.snapshot_time.timestamp(),
        }
    except SQLAlchemyError:
        return None
