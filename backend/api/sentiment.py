import requests
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from core.database import get_db
from core.utils import normalize_ticker
from core.config import USE_V2_READ_PATH
from services.cache_service import get_cached_sentiment
from services.sentiment_service import fetch_and_score_news, sentiment_from_history, sentiment_from_snapshot, sentiment_fallback

router = APIRouter()

@router.get("/api/sentiment")
def get_sentiment(
    ticker: str = Query(default="ALL", description="Ticker symbol like TSLA, AAPL, or ALL for market-wide sentiment"),
    db: Session = Depends(get_db),
) -> dict:
    normalized_ticker = normalize_ticker(ticker)

    cached = get_cached_sentiment(normalized_ticker)
    if cached is not None:
        return cached

    if USE_V2_READ_PATH:
        snapshot_payload = sentiment_from_snapshot(db, normalized_ticker)
        if snapshot_payload is not None:
            return snapshot_payload
        fallback = sentiment_fallback()
        fallback["ticker"] = normalized_ticker
        return fallback
    else:
        try:
            return fetch_and_score_news(db, normalized_ticker)
        except (requests.RequestException, ValueError, SQLAlchemyError):
            db.rollback()
            history_payload = sentiment_from_history(db, normalized_ticker)
            if history_payload is not None:
                return history_payload
            fallback = sentiment_fallback()
            fallback["ticker"] = normalized_ticker
            return fallback
