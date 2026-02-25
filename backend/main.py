"""SpecHouse FastAPI backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import properties, compare, enrich

app = FastAPI(
    title="SpecHouse API",
    description="Real estate aggregation + comparison platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties.router)
app.include_router(compare.router)
app.include_router(enrich.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
