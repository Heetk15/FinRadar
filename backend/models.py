from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, Integer, Numeric, String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base

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

class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    run_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    records_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

class NewsArticle(Base):
    __tablename__ = "news_articles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False)
    headline: Mapped[str] = mapped_column(String(2000), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sentiment_label: Mapped[str] = mapped_column(String(32), nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    ingestion_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

class SentimentSnapshot(Base):
    __tablename__ = "sentiment_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False)
    panic_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    positive_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    neutral_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    negative_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    snapshot_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingestion_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ingestion_runs.id", ondelete="CASCADE"), nullable=True
    )

class SnapshotArticle(Base):
    __tablename__ = "snapshot_articles"
    snapshot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sentiment_snapshots.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True
    )

Index("idx_ingestion_runs_status_started_at", IngestionRun.status, IngestionRun.started_at)
Index("idx_news_articles_ticker_published_at", NewsArticle.ticker, NewsArticle.published_at.desc())
Index("idx_sentiment_snapshots_ticker_time", SentimentSnapshot.ticker, SentimentSnapshot.snapshot_time.desc())
Index("idx_snapshot_articles_article_id", SnapshotArticle.article_id)
