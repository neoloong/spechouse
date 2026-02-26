"""AI natural language search parse endpoint."""
from fastapi import APIRouter, Query
from backend.services.ai_search import parse_query

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/parse")
async def parse_search(q: str = Query(..., min_length=1, description="Natural language search query")):
    """Parse a natural language query into structured search parameters."""
    return await parse_query(q)
