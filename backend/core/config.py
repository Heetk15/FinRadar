import os
from dotenv import load_dotenv

load_dotenv()

def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"missing required environment variable: {name}")
    return value

DATABASE_URL = _require_env("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
FINNHUB_API_KEY = _require_env("FINNHUB_API_KEY")
HUGGINGFACE_TOKEN = _require_env("HUGGINGFACE_TOKEN")

FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news"
FINNHUB_COMPANY_NEWS_URL = "https://finnhub.io/api/v1/company-news"
HF_FINBERT_URL = "https://router.huggingface.co/hf-inference/models/ProsusAI/finbert"
HEADLINE_LIMIT = 10
HF_MAX_ATTEMPTS = 6
HF_RETRY_BASE_SEC = 5.0
CACHE_TTL_SECONDS = 900
COMPANY_NEWS_LOOKBACK_DAYS = 7
WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD"]
USE_V2_READ_PATH = os.getenv("USE_V2_READ_PATH", "false").lower() == "true"
