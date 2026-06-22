# 🛡️ FinRadar // Financial Sentiment Terminal

A high-density, institutional-grade market intelligence platform. FinRadar monitors global financial news in real-time, using AI to quantify market panic and visualize systemic risk.

## 🚀 Key Features
- **Live Sentiment Monitor:** Real-time gauge quantifying market panic using FinBERT.
- **Market Analytics:** Interactive candlestick charts correlating SPY price action with sentiment volatility.
- **Contagion Web:** Force-directed keyword graph visualizing thematic connections between news events.
- **Live Ticker Tape:** High-frequency scrolling feed of global headlines and sentiment scores.

## 🛠️ Tech Stack
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Lightweight-Charts, D3.js.
- **Backend:** FastAPI, Python, FinBERT (NLP Model).
- **Infrastructure:** Docker, PostgreSQL, Redis.
- **Data Source:** Yahoo Finance & Global News Feeds.

## 📦 Quick Start (Docker)
1. Clone the repository.
2. Ensure Docker Desktop is running.
3. Run the following command:
   ```bash
   docker-compose up --build
Access the Terminal at http://localhost:3000.
