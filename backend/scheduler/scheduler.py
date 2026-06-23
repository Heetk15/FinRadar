import os
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from scheduler.ingestion_job import ingest_all_tickers_job

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

def start_scheduler():
    interval = int(os.getenv("INGESTION_INTERVAL_MINUTES", "15"))
    scheduler.add_job(
        ingest_all_tickers_job,
        trigger=CronTrigger(minute=f"*/{interval}"),
        id="ingest_all_tickers",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started.")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")
