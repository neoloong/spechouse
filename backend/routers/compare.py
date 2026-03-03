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
    schools = agg.get("schools", [])
    lifestyle = agg.get("lifestyle", {})
    crime = agg.get("crime", {})

    # Extract schools by level (elementary, middle, high)
    schools_by_level = {"elementary": None, "middle": None, "high": None}
    for s in schools:
        lvl = s.get("type")
        if lvl in schools_by_level and schools_by_level[lvl] is None:
            rating = s.get("rating")
            name = s.get("name", "")
            dist = s.get("distance_mi")
            if rating:
                schools_by_level[lvl] = f"{name} ({rating}/10)"
            elif dist:
                schools_by_level[lvl] = f"{name} ({dist} mi)"
            else:
                schools_by_level[lvl] = name

    price_per_sqft = None
    if prop.list_price and prop.sqft:
        price_per_sqft = round(float(prop.list_price) / prop.sqft, 2)

    # Get noise from lifestyle
    noise_keys = ["silent_zone", "quiet_area", "low_noise", "noisy_area"]
    noise_data = None
    for k in noise_keys:
        if k in lifestyle:
            noise_data = lifestyle[k]
            break

    return {
        "id": prop.id,
        "external_id": prop.external_id,
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
        "noise_score": noise_data.get("score") if noise_data else None,
        "noise_label": noise_data.get("label") if noise_data else None,
        "crime_score": crime.get("safety_score"),
        "crime_label": crime.get("label"),
        "score_overall": scores.get("overall"),
        "score_value": scores.get("value"),
        "score_investment": scores.get("investment"),
        "school_elementary": schools_by_level["elementary"],
        "school_middle": schools_by_level["middle"],
        "school_high": schools_by_level["high"],
        "photo_url": prop.photo_url,
    }


@router.get("")
async def compare_properties(
    ids: str = Query(None, description="Comma-separated internal property IDs, e.g. 1,2,3"),
    eids: str = Query(None, description="Comma-separated external_ids (shareable), e.g. redfin-123,redfin-456"),
    db: AsyncSession = Depends(get_db),
):
    # Support both internal ids and external_ids (for shareable links)
    if eids:
        eid_list = [e.strip() for e in eids.split(",") if e.strip()]
        if len(eid_list) < 2:
            raise HTTPException(status_code=400, detail="Provide at least 2 IDs to compare")
        if len(eid_list) > 4:
            raise HTTPException(status_code=400, detail="Compare at most 4 properties at once")
        stmt = select(PropertyORM).where(PropertyORM.external_id.in_(eid_list))
        result = await db.execute(stmt)
        props = result.scalars().all()
        prop_map = {p.external_id: p for p in props}
        specs = [_build_spec_row(prop_map[e]) for e in eid_list if e in prop_map]
    elif ids:
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
    else:
        raise HTTPException(status_code=400, detail="Provide either ids or eids parameter")

    return {"properties": specs}
