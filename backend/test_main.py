import os
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend/main.py can be imported in isolation during CI tests.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import main as main_module

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
main_module.engine = engine
main_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
main_module.Base.metadata.create_all(bind=engine)


def test_normalize_ticker_defaults_to_all() -> None:
    assert main_module.normalize_ticker(None) == "ALL"
    assert main_module.normalize_ticker("") == "ALL"
    assert main_module.normalize_ticker("   ") == "ALL"


def test_normalize_ticker_strips_and_uppercases() -> None:
    assert main_module.normalize_ticker(" tsla ") == "TSLA"


def test_extract_headlines_ignores_invalid_items() -> None:
    articles = [
        {"headline": "  First headline  "},
        {"headline": ""},
        {"headline": None},
        {"title": "Missing headline field"},
        "not-a-dict",
        {"headline": "Second headline"},
    ]
    assert main_module._extract_headlines_from_articles(articles) == ["First headline", "Second headline"]


def test_panic_score_from_finbert_probs_weights_negative_higher() -> None:
    classification = [
        {"label": "negative", "score": 0.7},
        {"label": "neutral", "score": 0.2},
        {"label": "positive", "score": 0.1},
    ]
    score = main_module.panic_score_from_finbert_probs(classification)
    assert round(score, 1) == 80.0


def test_sentiment_from_history_returns_latest_row() -> None:
    session = main_module.SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        older = now - timedelta(days=1)
        session.add(
            main_module.SentimentHistory(
                panic_score=10.0,
                top_headline="Older headline",
                ticker="ALL",
                timestamp=older,
            ),
        )
        session.add(
            main_module.SentimentHistory(
                panic_score=55.0,
                top_headline="Latest headline",
                ticker="ALL",
                timestamp=now,
            ),
        )
        session.commit()

        payload = main_module._sentiment_from_history(session, "ALL")
        assert payload is not None
        assert payload["panic_score"] == 55.0
        assert payload["top_headline"] == "Latest headline"
        assert payload["headlines"] == ["Latest headline"]
    finally:
        session.close()


def test_get_sentiment_falls_back_to_history(monkeypatch: pytest.MonkeyPatch) -> None:
    session = main_module.SessionLocal()
    try:
        session.add(
            main_module.SentimentHistory(
                panic_score=42.0,
                top_headline="Seeded headline",
                ticker="AAPL",
                timestamp=datetime.now(timezone.utc),
            ),
        )
        session.commit()

        def _raise_fetch(*_args, **_kwargs):
            raise ValueError("live fetch failed")

        monkeypatch.setattr(main_module, "fetch_and_score_news", _raise_fetch)
        monkeypatch.setattr(main_module, "_read_sentiment_cache", lambda _ticker: None)

        payload = main_module.get_sentiment(ticker="AAPL", db=session)
        assert payload["panic_score"] == 42.0
        assert payload["top_headline"] == "Seeded headline"
    finally:
        session.close()
