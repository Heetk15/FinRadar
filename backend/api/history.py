from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, ConfigDict

from core.database import get_db
from core.utils import normalize_ticker
from core.config import USE_V2_READ_PATH
from models import SentimentHistory, SentimentSnapshot, SnapshotArticle, NewsArticle

router = APIRouter()

class SentimentHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    panic_score: float
    top_headline: str
    ticker: str
    timestamp: datetime

@router.get("/api/history", response_model=list[SentimentHistoryRead])
def get_history(
    ticker: str = Query(default="ALL", description="Ticker symbol filter, or ALL for market-wide history"),
    db: Session = Depends(get_db),
):
    normalized_ticker = normalize_ticker(ticker)
    try:
        if USE_V2_READ_PATH:
            # Subquery to get one headline per snapshot (using MAX)
            subq = select(
                SnapshotArticle.snapshot_id,
                func.max(NewsArticle.headline).label("headline")
            ).select_from(SnapshotArticle).join(NewsArticle).group_by(SnapshotArticle.snapshot_id).subquery()
            
            stmt = select(
                SentimentSnapshot.id,
                SentimentSnapshot.panic_score,
                func.coalesce(subq.c.headline, "NO DATA").label("top_headline"),
                SentimentSnapshot.ticker,
                SentimentSnapshot.snapshot_time.label("timestamp")
            ).outerjoin(subq, subq.c.snapshot_id == SentimentSnapshot.id)
            
            if normalized_ticker != "ALL":
                stmt = stmt.where(SentimentSnapshot.ticker == normalized_ticker)
                
            rows = db.execute(stmt.order_by(SentimentSnapshot.snapshot_time.asc())).all()
            return [SentimentHistoryRead.model_validate(row) for row in rows]
        else:
            stmt = select(SentimentHistory)
            if normalized_ticker != "ALL":
                stmt = stmt.where(SentimentHistory.ticker == normalized_ticker)
            rows = db.scalars(stmt.order_by(SentimentHistory.timestamp.asc())).all()
            return list(rows)
    except SQLAlchemyError:
        return []
