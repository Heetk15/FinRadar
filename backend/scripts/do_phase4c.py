import os
import sys

BASE_DIR = r"d:\FinRadar\backend"

# Ensure scheduler directory exists
os.makedirs(os.path.join(BASE_DIR, "scheduler"), exist_ok=True)
with open(os.path.join(BASE_DIR, "scheduler", "__init__.py"), "w") as f:
    f.write("")

# 1. Update models.py
with open(os.path.join(BASE_DIR, "models.py"), "r") as f:
    models_content = f.read()

if "run_duration_ms" not in models_content:
    models_content = models_content.replace(
        "completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)",
        "completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)\n    run_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)"
    )
    with open(os.path.join(BASE_DIR, "models.py"), "w") as f:
        f.write(models_content)

# 2. Update finnhub_service.py
with open(os.path.join(BASE_DIR, "services", "finnhub_service.py"), "r") as f:
    finnhub_content = f.read()

if "def fetch_raw_articles" not in finnhub_content:
    finnhub_raw = """

def fetch_raw_articles(ticker: str) -> list[dict]:
    token = os.getenv("FINNHUB_API_KEY")
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
    data = response.json()
    if not isinstance(data, list):
        raise ValueError("unexpected Finnhub response shape")
    return data[:HEADLINE_LIMIT]
"""
    # ensure os is imported
    if "import os" not in finnhub_content:
        finnhub_content = "import os\n" + finnhub_content
    finnhub_content += finnhub_raw
    with open(os.path.join(BASE_DIR, "services", "finnhub_service.py"), "w") as f:
        f.write(finnhub_content)

# 3. Create ingestion_job.py
ingestion_job_py = """import time
import traceback
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from core.database import SessionLocal
from core.config import WATCHLIST
from models import IngestionRun, NewsArticle, SentimentSnapshot, SnapshotArticle
from services.finnhub_service import fetch_raw_articles
from services.sentiment_service import score_headline_finbert
from services.cache_service import write_sentiment_cache
import os

def process_ticker(db: Session, ticker: str, run_id: int):
    articles = fetch_raw_articles(ticker)
    if not articles:
        return 0

    inserted_articles = []
    line_scores = []
    hf_token = os.getenv("HUGGINGFACE_TOKEN")
    
    for item in articles:
        source_id = str(item.get("id", ""))
        headline = item.get("headline", "").strip()
        summary = item.get("summary", "")
        url = item.get("url", "")
        published_at_unix = item.get("datetime")
        
        if not source_id or not headline:
            continue
            
        published_at = datetime.fromtimestamp(published_at_unix, tz=timezone.utc) if published_at_unix else datetime.now(timezone.utc)
        
        # Calculate sentiment
        try:
            sentiment_score = score_headline_finbert(headline, hf_token)
        except Exception:
            sentiment_score = 50.0
            
        # simplistic label assignment
        if sentiment_score > 60:
            sentiment_label = "NEGATIVE"
        elif sentiment_score < 40:
            sentiment_label = "POSITIVE"
        else:
            sentiment_label = "NEUTRAL"
            
        # Upsert article
        stmt = insert(NewsArticle).values(
            source_id=source_id,
            ticker=ticker,
            headline=headline[:2000],
            summary=summary,
            url=url,
            published_at=published_at,
            sentiment_label=sentiment_label,
            sentiment_score=sentiment_score,
            ingestion_run_id=run_id,
            created_at=datetime.now(timezone.utc)
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=['source_id'])
        db.execute(stmt)
        
        # We need the article ID for the bridge table
        article_record = db.query(NewsArticle).filter(NewsArticle.source_id == source_id).first()
        if article_record:
            inserted_articles.append(article_record)
            line_scores.append(sentiment_score)
            
    if not line_scores:
        return 0
        
    panic_score = round(sum(line_scores) / len(line_scores), 2)
    snapshot_time = datetime.now(timezone.utc)
    
    snapshot = SentimentSnapshot(
        ticker=ticker,
        panic_score=panic_score,
        positive_score=0,
        neutral_score=0,
        negative_score=0,
        snapshot_time=snapshot_time,
        ingestion_run_id=run_id
    )
    db.add(snapshot)
    db.flush()
    
    for a in inserted_articles:
        bridge = SnapshotArticle(
            snapshot_id=snapshot.id,
            article_id=a.id
        )
        db.add(bridge)
        
    db.commit()
    
    # Cache V2
    payload = {
        "ticker": ticker,
        "panic_score": panic_score,
        "headlines": [a.headline for a in inserted_articles],
        "top_headline": inserted_articles[0].headline if inserted_articles else "",
        "timestamp": snapshot_time.timestamp()
    }
    write_sentiment_cache(payload, ticker)
    
    return len(inserted_articles)

def run_ingestion_pipeline(run_type="SCHEDULED"):
    db = SessionLocal()
    start_time = datetime.now(timezone.utc)
    start_ms = int(time.time() * 1000)
    
    run = IngestionRun(
        run_type=run_type,
        status="STARTED",
        started_at=start_time
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    
    total_processed = 0
    try:
        for ticker in WATCHLIST:
            processed = process_ticker(db, ticker, run.id)
            total_processed += processed
            
        run.status = "SUCCESS"
    except Exception as e:
        db.rollback()
        run.status = "FAILED"
        run.error_message = traceback.format_exc()
    finally:
        end_ms = int(time.time() * 1000)
        run.completed_at = datetime.now(timezone.utc)
        run.run_duration_ms = end_ms - start_ms
        run.records_processed = total_processed
        
        db.add(run)
        db.commit()
        db.close()

def ingest_all_tickers_job():
    run_ingestion_pipeline(run_type="SCHEDULED")
"""
with open(os.path.join(BASE_DIR, "scheduler", "ingestion_job.py"), "w") as f:
    f.write(ingestion_job_py)

# 4. Create scheduler.py
scheduler_py = """import os
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from scheduler.ingestion_job import ingest_all_tickers_job

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

def start_scheduler():
    interval = int(os.getenv("INGESTION_INTERVAL_MINUTES", "15"))
    scheduler.add_job(
        ingest_all_tickers_job,
        trigger=CronTrigger(minute=f"*/{interval}"),
        id="ingest_all_tickers",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started.")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")
"""
with open(os.path.join(BASE_DIR, "scheduler", "scheduler.py"), "w") as f:
    f.write(scheduler_py)

# 5. Update main.py
main_py = """from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from core.database import Base, engine
import models  # loads all schemas to attach to Base.metadata
from api.sentiment import router as sentiment_router
from api.screener import router as screener_router
from api.history import router as history_router
from scheduler.scheduler import start_scheduler, stop_scheduler
from scheduler.ingestion_job import run_ingestion_pipeline

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
    
    # Try adding run_duration_ms to ingestion_runs if it doesn't exist
    try:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS run_duration_ms INTEGER;"))
    except Exception:
        pass
        
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="FinRadar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentiment_router)
app.include_router(screener_router)
app.include_router(history_router)

@app.post("/admin/run-ingestion")
def trigger_ingestion():
    run_ingestion_pipeline(run_type="MANUAL")
    return {"status": "Ingestion completed successfully."}
"""
with open(os.path.join(BASE_DIR, "main.py"), "w") as f:
    f.write(main_py)

print("Phase 4C implementation script completed.")
