def normalize_ticker(raw_ticker: str | None) -> str:
    candidate = (raw_ticker or "ALL").strip().upper()
    if not candidate:
        return "ALL"
    return candidate
