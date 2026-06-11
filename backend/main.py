"""
Procurement Intelligence Engine — FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from db.session import init_db, db_session
from anomaly.detector import run_full_scan
from api.rag_routes import router as rag_router
from api.anomaly_routes import router as anomaly_router
from api.analytics_routes import router as analytics_router
from api.procurement_routes import router as procurement_router


def scheduled_anomaly_scan():
    """Runs daily anomaly scan via APScheduler."""
    with db_session() as db:
        summary = run_full_scan(db)
        print(f"[Scheduler] Anomaly scan complete: {summary}")


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initialising database...")
    init_db()

    # Try to pre-build FAISS index
    try:
        from rag.indexer import get_vectorstore
        get_vectorstore()
    except Exception as e:
        print(f"[Warning] Could not build FAISS index on startup: {e}")
        print("  → Run the seed script and call POST /api/rag/rebuild-index")

    # Run initial anomaly scan
    try:
        with db_session() as db:
            run_full_scan(db)
    except Exception as e:
        print(f"[Warning] Initial anomaly scan failed: {e}")

    # Schedule daily scan at 02:00
    scheduler.add_job(scheduled_anomaly_scan, "cron", hour=2, minute=0)
    scheduler.start()
    print("✓ Background scheduler started")

    yield

    # Shutdown
    scheduler.shutdown()
    print("Scheduler stopped")


app = FastAPI(
    title="Procurement Intelligence Engine",
    description="RAG-powered procurement analytics with anomaly detection and Odoo integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(rag_router)
app.include_router(anomaly_router)
app.include_router(analytics_router)
app.include_router(procurement_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "odoo_enabled": settings.USE_ODOO,
    }
