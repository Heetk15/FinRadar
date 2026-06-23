import os
import requests
from datetime import datetime, timedelta, timezone
from core.config import FINNHUB_API_KEY, FINNHUB_NEWS_URL, FINNHUB_COMPANY_NEWS_URL, COMPANY_NEWS_LOOKBACK_DAYS, HEADLINE_LIMIT

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
    if ticker == "ALL":
        response = requests.get(
            FINNHUB_NEWS_URL,
            params={"category": "general", "token": FINNHUB_API_KEY},
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
                "token": FINNHUB_API_KEY,
            },
            timeout=30,
        )

    response.raise_for_status()
    headlines = _extract_headlines_from_articles(response.json())
    if not headlines:
        raise ValueError(f"no headlines returned from Finnhub for ticker {ticker}")
    return headlines


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
