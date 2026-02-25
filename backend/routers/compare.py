"""Compare endpoint — returns side-by-side spec matrix for N properties."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db import get_db
from backend.models.property import PropertyORM

router = APIRouter(prefix="/compare", tags=["compare"])


def _build_spec_row(prop: PropertyORM) -> dict:
    agg = prop.agg_data or {}
    rental = agg.get("rental", {})
    env = agg.get("environment", {})
    scores = agg.get("scores", {})

    price_per_sqft = None
    if prop.list_price and prop.sqft:
        price_per_sqft = round(float(prop.list_price) / prop.sqft, 2)

    return {
        "id": prop.id,
        "address_display": prop.address_display,
        "city": prop.city,
        "state": prop.state,
        "zip_code": prop.zip_code,
        "latitude": prop.latitude,
        "longitude": prop.longitude,
        "list_price": float(prop.list_price) if prop.list_price else None,
        "price_per_sqft": price_per_sqft,
        "rental_estimate": rental.get("estimate"),
        "rental_yield_pct": rental.get("yield_pct"),
        "cap_rate": rental.get("cap_rate"),
        "beds": prop.beds,
        "baths": float(prop.baths) if prop.baths else None,
        "sqft": prop.sqft,
        "lot_sqft": prop.lot_sqft,
        "year_built": prop.year_built,
        "property_type": prop.property_type,
        "hoa_fee": float(prop.hoa_fee) if prop.hoa_fee else None,
        "property_tax": float(prop.property_tax) if prop.property_tax else None,
        "noise_db": env.get("noise_db"),
        "noise_label": env.get("noise_label"),
        "crime_score": env.get("crime_score"),
        "score_overall": scores.get("overall"),
        "score_value": scores.get("value"),
        "score_investment": scores.get("investment"),
    }


@router.get("")
async def compare_properties(
    ids: str = Query(..., description="Comma-separated property IDs, e.g. 1,2,3"),
    db: AsyncSession = Depends(get_db),
):
    try:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")

    if len(id_list) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 IDs to compare")
    if len(id_list) > 4:
        raise HTTPException(status_code=400, detail="Compare at most 4 properties at once")

    stmt = select(PropertyORM).where(PropertyORM.id.in_(id_list))
    result = await db.execute(stmt)
    props = result.scalars().all()

    if len(props) != len(id_list):
        found_ids = {p.id for p in props}
        missing = set(id_list) - found_ids
        raise HTTPException(status_code=404, detail=f"Properties not found: {missing}")

    prop_map = {p.id: p for p in props}
    specs = [_build_spec_row(prop_map[i]) for i in id_list]

    return {"properties": specs}
