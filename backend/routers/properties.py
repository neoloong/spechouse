"""Property search and detail endpoints."""
from typing import Optional, List
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from datetime import datetime

from backend.db import get_db
from backend.models.property import PropertyORM, PropertyListItem, PropertyOut
from backend.services import howloud, scorer, redfin
from backend.services.mock_data import MOCK_PROPERTIES, MOCK_AGG
from backend.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/properties", tags=["properties"])


def _use_mock() -> bool:
    return not settings.RENTCAST_API_KEY or settings.RENTCAST_API_KEY.startswith("your_")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _upsert_property(db: AsyncSession, data: dict) -> PropertyORM:
    # Pull out non-ORM fields before processing
    redfin_url = data.pop("_redfin_url", None)

    stmt = select(PropertyORM).where(PropertyORM.external_id == data["external_id"])
    result = await db.execute(stmt)
    prop = result.scalar_one_or_none()

    geom = None
    if data.get("latitude") and data.get("longitude"):
        geom = ST_SetSRID(ST_MakePoint(data["longitude"], data["latitude"]), 4326)

    if prop is None:
        initial_agg = {}
        if redfin_url:
            initial_agg["_redfin_url"] = redfin_url
        prop = PropertyORM(
            external_id=data["external_id"],
            address_display=data["address_display"],
            city=data.get("city"),
            state=data.get("state"),
            zip_code=data.get("zip_code"),
            beds=data.get("beds"),
            baths=data.get("baths"),
            sqft=data.get("sqft"),
            lot_sqft=data.get("lot_sqft"),
            year_built=data.get("year_built"),
            hoa_fee=data.get("hoa_fee"),
            property_tax=data.get("property_tax"),
            list_price=data.get("list_price"),
            property_type=data.get("property_type"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            photo_url=data.get("photo_url"),
            photos=data.get("photos", []),
            source=data.get("source", "redfin"),
            geom=geom,
            agg_data=initial_agg,
        )
        db.add(prop)
    else:
        for k, v in data.items():
            if k not in ("id", "agg_data") and hasattr(prop, k):
                setattr(prop, k, v)
        if geom is not None:
            prop.geom = geom
        # Store redfin_url in agg_data if not already there
        if redfin_url and not (prop.agg_data or {}).get("_redfin_url"):
            new_agg = dict(prop.agg_data or {})
            new_agg["_redfin_url"] = redfin_url
            prop.agg_data = new_agg

    await db.commit()
    await db.refresh(prop)
    return prop


async def _enrich_property(prop_id: int, db: AsyncSession) -> None:
    """Fetch noise data, compute scores, and scrape photo. Runs once per property."""
    stmt = select(PropertyORM).where(PropertyORM.id == prop_id)
    result = await db.execute(stmt)
    prop = result.scalar_one_or_none()
    if prop is None:
        return

    noise_data: dict = {}
    if prop.latitude and prop.longitude:
        noise_data = await howloud.get_noise(prop.latitude, prop.longitude)

    new_agg = scorer.enrich_agg_data(
        current_agg=prop.agg_data or {},
        list_price=float(prop.list_price) if prop.list_price else None,
        sqft=prop.sqft,
        noise_data=noise_data,
        city=prop.city,
        state=prop.state,
        beds=prop.beds,
    )

    # Fetch photo from Redfin listing page if still missing
    photo_url = prop.photo_url
    photos = prop.photos or []
    if not photo_url:
        redfin_url = (prop.agg_data or {}).get("_redfin_url")
        if redfin_url:
            fetched = await redfin.fetch_photo_url(redfin_url)
            if fetched:
                photo_url = fetched
                photos = [fetched]
                logger.info(f"Fetched photo for property {prop_id}: {fetched}")

    await db.execute(
        update(PropertyORM)
        .where(PropertyORM.id == prop_id)
        .values(
            agg_data=new_agg,
            last_enriched=datetime.utcnow(),
            photo_url=photo_url,
            photos=photos,
        )
    )
    await db.commit()


async def _cached_city_results(
    db: AsyncSession,
    city: Optional[str],
    zip_code: Optional[str],
    beds: Optional[int],
    max_price: Optional[float],
    limit: int,
) -> Optional[List[PropertyORM]]:
    """Return DB-cached results if we already have data for this city/zip."""
    stmt = select(PropertyORM)
    if city:
        # Use first word of city for matching ("Fremont, CA" → "Fremont")
        city_base = city.split(",")[0].split()[0]
        stmt = stmt.where(PropertyORM.city.ilike(f"%{city_base}%"))
    elif zip_code:
        stmt = stmt.where(PropertyORM.zip_code == zip_code)
    else:
        return None

    if beds:
        stmt = stmt.where(PropertyORM.beds >= beds)
    if max_price:
        stmt = stmt.where(PropertyORM.list_price <= max_price)

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return list(rows) if rows else None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[PropertyListItem])
async def search_properties(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    zip_code: Optional[str] = Query(None),
    beds: Optional[int] = Query(None),
    max_price: Optional[float] = Query(None),
    property_type: Optional[str] = Query(None),
    limit: int = Query(20, le=40),
):
    # ── Mock mode ─────────────────────────────────────────────────────────────
    if _use_mock():
        props = []
        for data in MOCK_PROPERTIES:
            if beds and (data.get("beds") or 0) < beds:
                continue
            if max_price and (data.get("list_price") or 0) > max_price:
                continue
            prop = await _upsert_property(db, dict(data))
            agg = MOCK_AGG.get(data["external_id"], {})
            if agg and not prop.agg_data:
                await db.execute(
                    update(PropertyORM)
                    .where(PropertyORM.id == prop.id)
                    .values(agg_data=agg)
                )
                await db.commit()
                await db.refresh(prop)
            props.append(prop)
        return props[:limit]

    # ── Cache-first: return DB results if available ───────────────────────────
    cached = await _cached_city_results(db, city, zip_code, beds, max_price, limit)
    if cached:
        logger.info(f"Cache hit for city={city} — skipping Redfin call")
        return cached

    # ── Redfin (free, no API key needed) ─────────────────────────────────────
    # Pass the full city string to Redfin service — it uses Nominatim to
    # geocode "Fremont, CA" or "Fremont" correctly without a TX hardcoded fallback
    try:
        raw_listings = await redfin.search_listings(
            city=city or "",
            state=state,
            beds_min=beds,
            price_max=max_price,
            limit=limit,
        )
    except Exception as exc:
        logger.warning(f"Redfin failed: {exc}")
        raw_listings = []

    if not raw_listings:
        raise HTTPException(
            status_code=502,
            detail=f"No listings found for {city}. Try a different city name.",
        )

    props = []
    for parsed in raw_listings:
        if not parsed.get("external_id"):
            continue
        prop = await _upsert_property(db, parsed)
        if prop.last_enriched is None:
            background_tasks.add_task(_enrich_property, prop.id, db)
        props.append(prop)

    return props



@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(
    property_id: int,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PropertyORM).where(PropertyORM.id == property_id)
    result = await db.execute(stmt)
    prop = result.scalar_one_or_none()
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop
