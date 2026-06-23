import time
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
