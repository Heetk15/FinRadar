# FinRadar

A market intelligence platform that continuously ingests financial news, performs NLP-based sentiment analysis, and serves low-latency insights through a scheduled data pipeline.

Built using FastAPI, PostgreSQL, Redis, APScheduler, FinBERT, and Next.js.

## The Problem

Traditional sentiment dashboards often perform data collection and sentiment analysis during user requests, leading to:

* High response latency
* Repeated external API calls
* Poor scalability
* Tight coupling between ingestion and serving

FinRadar was built to decouple data ingestion from user-facing APIs through a scheduled ETL architecture.

## Key Features

* Scheduled financial news ingestion
* FinBERT-powered sentiment analysis
* Historical sentiment tracking and trend analysis
* Redis-backed low-latency reads
* Operational metrics and pipeline monitoring
* Feature-flagged architecture migration

## Architecture Highlights

### Background Ingestion Pipeline

News collection and sentiment analysis run independently of user requests using APScheduler.

### Snapshot-Based Analytics

Sentiment data is stored as time-series snapshots for efficient historical analysis and charting.

### Cache-Aside Read Model

Redis serves hot data while PostgreSQL acts as the source of truth.

### Data Lineage

Every sentiment snapshot can be traced back to the source articles that contributed to it.

### Observability

Pipeline execution history, processing duration, and success metrics are exposed through administrative endpoints.

## Tech Stack

### Frontend

* Next.js
* React
* Tailwind CSS

### Backend

* FastAPI
* SQLAlchemy
* APScheduler

### Data & Infrastructure

* PostgreSQL
* Redis
* Docker
* Jenkins

### NLP

* FinBERT (ProsusAI/finbert)
* Hugging Face Inference API

## Concepts Demonstrated

* ETL Pipelines
* Background Job Scheduling
* Cache-Aside Pattern
* Feature Flags
* Data Lineage
* Snapshot Architecture
* Redis Caching
* Database Indexing
* Observability
* API Design
