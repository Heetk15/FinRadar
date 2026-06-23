from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError

from core.database import get_db
from models import IngestionRun, SentimentSnapshot, NewsArticle
from scheduler.ingestion_job import run_ingestion_pipeline

router = APIRouter()

@router.post("/admin/run-ingestion")
def trigger_ingestion():
    run_ingestion_pipeline(run_type="MANUAL")
    return {"status": "Ingestion completed successfully."}

@router.get("/admin/pipeline-stats")
def get_pipeline_stats(db: Session = Depends(get_db)):
    try:
        # Get the most recent run
        latest_run = db.scalars(
            select(IngestionRun).order_by(IngestionRun.started_at.desc())
        ).first()

        last_run_status = latest_run.status if latest_run else "NONE"
        last_run_duration_seconds = None
        articles_processed = latest_run.records_processed if latest_run else 0

        if latest_run and latest_run.completed_at:
            delta = latest_run.completed_at - latest_run.started_at
            last_run_duration_seconds = int(delta.total_seconds())

        # Get total counts
        total_snapshots = db.scalar(select(func.count(SentimentSnapshot.id))) or 0
        total_articles = db.scalar(select(func.count(NewsArticle.id))) or 0

        # Success rate and avg duration
        completed_runs = db.scalars(
            select(IngestionRun).where(IngestionRun.completed_at.is_not(None))
        ).all()
        
        success_count = sum(1 for r in completed_runs if r.status == "SUCCESS")
        total_completed = len(completed_runs)
        success_rate = (success_count / total_completed * 100) if total_completed > 0 else 100.0

        avg_run_duration_seconds = 0
        if total_completed > 0:
            total_duration = sum((r.completed_at - r.started_at).total_seconds() for r in completed_runs)
            avg_run_duration_seconds = int(total_duration / total_completed)

        return {
            "last_run_status": last_run_status,
            "last_run_duration_seconds": last_run_duration_seconds,
            "articles_processed": articles_processed,
            "total_snapshots": total_snapshots,
            "success_rate": success_rate,
            "total_articles": total_articles,
            "avg_run_duration_seconds": avg_run_duration_seconds
        }
    except SQLAlchemyError as e:
        return {"error": str(e)}

@router.get("/admin/runs")
def get_ingestion_runs(db: Session = Depends(get_db)):
    try:
        runs = db.scalars(
            select(IngestionRun).order_by(IngestionRun.started_at.desc()).limit(50)
        ).all()
        
        result = []
        for r in runs:
            duration = None
            if r.completed_at:
                duration = int((r.completed_at - r.started_at).total_seconds())
                
            result.append({
                "id": r.id,
                "status": r.status,
                "processed": r.records_processed,
                "duration_seconds": duration,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            })
        return result
    except SQLAlchemyError as e:
        return {"error": str(e)}
