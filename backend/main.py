"""SpecHouse FastAPI backend."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import engine, Base
from backend.routers import properties, compare, enrich, search_ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (works for SQLite; no-op if already exist)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="SpecHouse API",
    description="Real estate aggregation + comparison platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://spechouse.vercel.app", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties.router)
app.include_router(compare.router)
app.include_router(enrich.router)
app.include_router(search_ai.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
