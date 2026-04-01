"""Internal enrichment trigger endpoint."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db import get_db
from backend.models.property import PropertyORM
from backend.routers.properties import _enrich_property
from backend.routers.deps import require_api_key

router = APIRouter(prefix="/enrich", tags=["enrich"])


@router.post("/{property_id}", dependencies=[Depends(require_api_key)])
async def trigger_enrichment(
    property_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger enrichment for a single property."""
    stmt = select(PropertyORM).where(PropertyORM.id == property_id)
    result = await db.execute(stmt)
    prop = result.scalar_one_or_none()
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")

    background_tasks.add_task(_enrich_property, property_id)
    return {"status": "enrichment queued", "property_id": property_id}
