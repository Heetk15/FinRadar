# FinRadar: Market Intelligence Data Platform

FinRadar is a scheduled, high-performance market intelligence data platform. It continuously ingests financial news, scores market sentiment using FinBERT (NLP), and stores lineage-aware analytical snapshots to serve low-latency insights via a Redis-backed API.

![FinRadar Architecture](file:///C:/Users/HEET/.gemini/antigravity-ide/brain/1f34c951-51ce-4433-ab96-16951988f70b/finradar_architecture_1782251940778.png)

## The Problem
Market intelligence systems often perform expensive NLP analysis synchronously during user requests. This creates massive latency spikes (up to 40 seconds) and tightly couples data ingestion with API serving, making the platform fragile and unscalable.

## The Solution (V2 Architecture)
FinRadar solves this by decoupling ingestion from serving. A scheduled background pipeline handles the heavy lifting of fetching data and running ML inference, while the user-facing API simply reads pre-computed snapshots from a Redis cache.

### Scheduled Ingestion Flow
```mermaid
sequenceDiagram
    participant Scheduler as APScheduler
    participant Finnhub as Finnhub API
    participant NLP as FinBERT (HuggingFace)
    participant DB as PostgreSQL
    participant Cache as Redis

    Scheduler->>Finnhub: Fetch latest news articles
    Finnhub-->>Scheduler: Return news JSON
    Scheduler->>NLP: Batch score headlines
    NLP-->>Scheduler: Return sentiment scores (0.0 to 1.0)
    Scheduler->>DB: Save NewsArticles & SentimentSnapshots
    Scheduler->>Cache: Update materialized view in Redis
```

### User Read Flow
```mermaid
sequenceDiagram
    participant User as Frontend (Next.js)
    participant API as FastAPI
    participant Cache as Redis
    participant DB as PostgreSQL

    User->>API: GET /api/sentiment
    API->>Cache: Check cached snapshot
    alt Cache Hit (20-50ms)
        Cache-->>API: Return JSON
    else Cache Miss
        API->>DB: Query latest SentimentSnapshot
        DB-->>API: Return DB row
    end
    API-->>User: Return Sentiment Data
```

## Production Metrics
By migrating to this architecture, FinRadar achieves enterprise-grade performance:
- **Pipeline Execution**: ~238 seconds per run
- **Throughput**: ~80 articles processed per run
- **Cache Hit Latency**: 20ms - 50ms (Down from 8-40 seconds)
- **Availability**: 100% decoupling from upstream Finnhub rate limits during user requests.

## Deployment Architecture
```mermaid
graph TD
    User([End User]) --> NextJS[Next.js Frontend]
    NextJS --> FastAPI[FastAPI Backend]
    
    subgraph Docker Compose
        FastAPI --> Redis[(Redis Cache)]
        FastAPI --> Postgres[(PostgreSQL)]
        Scheduler[APScheduler Background Task] --> Postgres
        Scheduler --> Redis
    end
    
    Scheduler --> Finnhub[Finnhub API]
    Scheduler --> HuggingFace[HuggingFace FinBERT]
```

## Migration Story & Feature Flags
This platform evolved from a simplistic request-driven architecture (V1) to a robust background-pipeline architecture (V2).

To safely migrate production traffic without downtime, the V2 read paths were introduced behind a feature flag: `USE_V2_READ_PATH=true`. This allowed us to shadow-deploy the background pipeline, verify the data integrity in PostgreSQL, and instantly switch API reads over to the new schema with zero rollback risk.

## Internal Scripts
Note: You may find `do_refactor.py` and `do_phase4c.py` inside `backend/scripts/`. These are internal migration scripts used during the architectural refactoring phase to migrate the codebase and test the transition.

## Architecture Decision Records (ADR)
For detailed insights into the engineering trade-offs made during the design of FinRadar, please refer to our ADRs in `docs/adr/`:
- **ADR-001**: Why APScheduler instead of Celery
- **ADR-002**: Why Snapshot Architecture
- **ADR-003**: Why Redis Cache
- **ADR-004**: Why Feature Flags
