"""SpecHouse FastAPI backend."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import engine, Base, SessionLocal
from backend.models.property import PropertyORM
from backend.routers import properties, compare, enrich, search_ai
from backend.routers.properties import _enrich_property
from sqlalchemy import select


async def _enrich_stale_properties(stale_hours: int = 6) -> int:
    """Re-enrich all properties whose last_enriched is None or older than stale_hours.
    Processes in batches with a semaphore to avoid overwhelming external APIs.
    Returns the number of properties queued for enrichment."""
    cutoff = datetime.utcnow() - timedelta(hours=stale_hours)
    async with SessionLocal() as db:
        stmt = select(PropertyORM.id).where(
            (PropertyORM.last_enriched == None)  # noqa: E711
            | (PropertyORM.last_enriched < cutoff)
        )
        result = await db.execute(stmt)
        prop_ids = [row[0] for row in result.fetchall()]

    if not prop_ids:
        return 0

    # Process in batches of 20, max 5 concurrent
    semaphore = asyncio.Semaphore(5)
    batch_size = 20

    async def enrich_with_limit(prop_id: int):
        async with semaphore:
            try:
                await _enrich_property(prop_id)
            except Exception:
                pass  # Swallow errors in background enrichment

    for i in range(0, len(prop_ids), batch_size):
        batch = prop_ids[i:i + batch_size]
        await asyncio.gather(*[enrich_with_limit(pid) for pid in batch])

    return len(prop_ids)


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (works for SQLite; no-op if already exist)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Schedule periodic re-enrichment every 6 hours
    scheduler.add_job(
        _enrich_stale_properties,
        trigger=IntervalTrigger(hours=6),
        args=[6],
        id="re_enrich_stale",
        replace_existing=True,
    )
    scheduler.start()
    print("[scheduler] Started — re-enrichment every 6h")

    # Kick off initial stale-enrichment in the background (don't block startup)
    async def initial_enrich():
        count = await _enrich_stale_properties(stale_hours=6)
        print(f"[scheduler] Initial enrichment done: {count} properties refreshed")

    asyncio.create_task(initial_enrich())

    yield
    scheduler.shutdown()

app = FastAPI(
    title="SpecHouse API",
    description="Real estate aggregation + comparison platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://spechouse.vercel.app",
        "https://*.vercel.app",
        "https://matchable-hildegard-untransformed.ngrok-free.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(properties.router)
app.include_router(compare.router)
app.include_router(enrich.router)
app.include_router(search_ai.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
