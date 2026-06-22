import os
import random
import math
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text

# Connect to your Docker database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://FinRadar_user:FinRadar_password@db:5432/FinRadar_db")
engine = create_engine(DATABASE_URL)

tickers = ["ALL", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD"]

headlines_high = [
    "Global markets plummet amid new regulatory fears",
    "Tech sector crashes as inflation data misses estimates",
    "Recession warnings trigger massive institutional sell-off",
    "Supply chain crisis worsens, major factories halt operations"
]

headlines_low = [
    "Record breaking earnings for tech sector ignite massive rally",
    "Inflation cools faster than expected, markets hit all-time highs",
    "Fed signals aggressive rate cuts, investors rejoice",
    "Unemployment hits historic low, consumer confidence peaks"
]

headlines_neutral = [
    "Markets trade sideways ahead of upcoming Fed policy meeting",
    "Tech giants announce routine product lifecycle updates",
    "Consumer spending remains steady through the third quarter",
    "Mixed reactions to new international trade policies"
]

def generate_seed_data():
    print("Initializing Data Seed Sequence...")
    with engine.begin() as conn:
        now = datetime.now(timezone.utc)
        
        # Generate 365 days of data backwards
        for i in range(365):
            date = now - timedelta(days=i)
            
            for ticker in tickers:
                # Create a realistic "wave" of market emotion over the year
                base_score = 50 + 30 * math.sin(i / 15.0) + random.uniform(-10, 10)
                score = max(0, min(100, base_score)) # Clamp between 0 and 100
                
                if score >= 60:
                    headline = random.choice(headlines_high) + f" [{ticker}]"
                elif score <= 40:
                    headline = random.choice(headlines_low) + f" [{ticker}]"
                else:
                    headline = random.choice(headlines_neutral) + f" [{ticker}]"
                    
                conn.execute(
                    text("""
                    INSERT INTO sentiment_history (ticker, panic_score, top_headline, timestamp)
                    VALUES (:ticker, :score, :headline, :timestamp)
                    """),
                    {"ticker": ticker, "score": round(score, 2), "headline": headline, "timestamp": date}
                )
    print("SUCCESS: 365 Days of historical sentiment data injected!")

if __name__ == "__main__":
    generate_seed_data()
