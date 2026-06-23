from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from core.database import Base, engine
import models  # loads all schemas to attach to Base.metadata
from api.sentiment import router as sentiment_router
from api.screener import router as screener_router
from api.history import router as history_router
from api.admin import router as admin_router
from scheduler.scheduler import start_scheduler, stop_scheduler

def ensure_history_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("sentiment_history")}
    except SQLAlchemyError:
        return

    if "ticker" in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE sentiment_history "
                "ADD COLUMN ticker VARCHAR(32) NOT NULL DEFAULT 'ALL'",
            ),
        )

@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_history_schema()
    
    # Try adding run_duration_ms to ingestion_runs if it doesn't exist
    try:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS run_duration_ms INTEGER;"))
    except Exception:
        pass
        
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="FinRadar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentiment_router)
app.include_router(screener_router)
app.include_router(history_router)
app.include_router(admin_router)
