import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel

from core.database import get_db
from core.utils import normalize_ticker
from core.config import WATCHLIST, USE_V2_READ_PATH
from services.cache_service import get_cached_sentiment
from services.sentiment_service import fetch_and_score_news, sentiment_from_snapshot

router = APIRouter()

class ScreenerItem(BaseModel):
    ticker: str
    panic_score: float | None
    top_headline: str

@router.get("/api/screener", response_model=list[ScreenerItem])
def get_screener(db: Session = Depends(get_db)) -> list[ScreenerItem]:
    items: list[ScreenerItem] = []

    for ticker in WATCHLIST:
        normalized_ticker = normalize_ticker(ticker)
        cached = get_cached_sentiment(normalized_ticker)
        
        if cached is None:
            if USE_V2_READ_PATH:
                cached = sentiment_from_snapshot(db, normalized_ticker)
                if cached is None:
                    cached = {
                        "ticker": normalized_ticker,
                        "panic_score": None,
                        "top_headline": "",
                        "headlines": [],
                        "timestamp": None,
                    }
            else:
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
