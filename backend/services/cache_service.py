import json
import redis
from core.redis_client import redis_client
from core.config import CACHE_TTL_SECONDS

def cache_key_for_ticker(ticker: str) -> str:
    return f"current_sentiment:{ticker}"

def write_sentiment_cache(payload: dict, ticker: str) -> None:
    try:
        redis_client.setex(cache_key_for_ticker(ticker), CACHE_TTL_SECONDS, json.dumps(payload))
    except redis.RedisError:
        pass

def get_cached_sentiment(ticker: str) -> dict | None:
    try:
        cached = redis_client.get(cache_key_for_ticker(ticker))
    except redis.RedisError:
        return None
    if cached is None:
        return None
    try:
        payload = json.loads(cached)
        if not isinstance(payload, dict):
            return None
        return payload
    except json.JSONDecodeError:
        return None
