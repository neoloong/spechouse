"""Shared route dependencies."""
from fastapi import Header, HTTPException

from backend.config import settings


async def require_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """Block requests that don't carry the internal API key."""
    if not settings.INTERNAL_API_KEY:
        return  # Dev mode: skip check if key not configured
    if x_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
