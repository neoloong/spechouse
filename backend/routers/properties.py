"""Property search and detail endpoints."""
from typing import Optional, List
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from datetime import datetime

from backend.db import get_db, SessionLocal
from backend.models.property import PropertyORM, PropertyListItem, PropertyOut
from backend.services import howloud, scorer, redfin, schools as schools_svc, crime as crime_svc
from backend.services.mock_data import MOCK_PROPERTIES, MOCK_AGG
from backend.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/properties", tags=["properties"])


def _use_mock() -> bool:
    # Only use mock data if explicitly opted in via env var USE_MOCK_DATA=true
    # Redfin scraping is free and requires no API key — use it by default
    return str(getattr(settings, "USE_MOCK_DATA", "")).lower() == "true"


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


# Price floor: skip enrichment for listings that are almost certainly bad data.
# E.g. SF condos listed at $146k are Redfin scraping errors, not real deals.
_MIN_PRICE = 50_000


async def _enrich_property(prop_id: int) -> None:
    """Fetch noise data, compute scores, and scrape photo. Runs once per property.
    Creates its own DB session — background tasks cannot reuse the request session."""
    async with SessionLocal() as db:
        stmt = select(PropertyORM).where(PropertyORM.id == prop_id)
        result = await db.execute(stmt)
        prop = result.scalar_one_or_none()
        if prop is None:
            return

        # Guard: skip listings with obviously bad price data
        if prop.list_price is not None and prop.list_price < _MIN_PRICE:
            await db.execute(
                update(PropertyORM)
                .where(PropertyORM.id == prop_id)
                .values(last_enriched=datetime.utcnow())
            )
            await db.commit()
            return

        noise_data: dict = {}
        schools_data: list = []
        crime_data: Optional[dict] = None
        redfin_url_for_schools = (prop.agg_data or {}).get("_redfin_url")
        if prop.latitude and prop.longitude:
            if redfin_url_for_schools:
                noise_data, schools_data, crime_data, lifestyle_data = await asyncio.gather(
                    howloud.get_noise(prop.latitude, prop.longitude),
                    schools_svc.fetch_redfin_schools(redfin_url_for_schools),
                    crime_svc.get_crime_score(prop.latitude, prop.longitude, prop.city or "", prop.state or ""),
                    schools_svc.fetch_redfin_lifestyle(redfin_url_for_schools),
                )
            else:
                noise_data, schools_data, crime_data = await asyncio.gather(
                    howloud.get_noise(prop.latitude, prop.longitude),
                    schools_svc.get_nearby_schools(prop.latitude, prop.longitude),
                    crime_svc.get_crime_score(prop.latitude, prop.longitude, prop.city or "", prop.state or ""),
                )
                lifestyle_data = {}

        new_agg = await scorer.enrich_agg_data(
            current_agg=prop.agg_data or {},
            list_price=float(prop.list_price) if prop.list_price else None,
            sqft=prop.sqft,
            noise_data=noise_data,
            city=prop.city,
            state=prop.state,
            beds=prop.beds,
        )
        if schools_data:
            new_agg["schools"] = schools_data
        if crime_data:
            new_agg["crime"] = crime_data
        if lifestyle_data:
            new_agg["lifestyle"] = lifestyle_data

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


_PTYPE_SQL_PATTERNS = {
    "house": "%single%family%",
    "condo": "%condo%",
    "townhouse": "%townhouse%",
    "multi-family": "%multi%family%",
    "land": "%land%",
    "mobile": "%mobile%",
}


async def _cached_city_results(
    db: AsyncSession,
    city: Optional[str],
    zip_code: Optional[str],
    beds: Optional[int],
    min_baths: Optional[float],
    max_price: Optional[float],
    min_price: Optional[float],
    property_type: Optional[str],
    min_sqft: Optional[int],
    max_sqft: Optional[int],
    limit: int,
) -> Optional[List[PropertyORM]]:
    """Return DB-cached results if we already have data for this city/zip."""
    stmt = select(PropertyORM)
    if city:
        city_base = city.split(",")[0].split()[0]
        stmt = stmt.where(PropertyORM.city.ilike(f"%{city_base}%"))
    elif zip_code:
        stmt = stmt.where(PropertyORM.zip_code == zip_code)
    else:
        return None

    if beds:
        stmt = stmt.where(PropertyORM.beds >= beds)
    if min_baths:
        stmt = stmt.where(PropertyORM.baths >= min_baths)
    if max_price:
        stmt = stmt.where(PropertyORM.list_price <= max_price)
    if min_price:
        stmt = stmt.where(PropertyORM.list_price >= min_price)
    if property_type and property_type in _PTYPE_SQL_PATTERNS:
        stmt = stmt.where(PropertyORM.property_type.ilike(_PTYPE_SQL_PATTERNS[property_type]))
    if min_sqft:
        stmt = stmt.where(PropertyORM.sqft >= min_sqft)
    if max_sqft:
        stmt = stmt.where(PropertyORM.sqft <= max_sqft)

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
    min_baths: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    min_price: Optional[float] = Query(None),
    property_type: Optional[str] = Query(None),
    min_sqft: Optional[int] = Query(None),
    max_sqft: Optional[int] = Query(None),
    limit: int = Query(40, le=350),
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
    cached = await _cached_city_results(
        db, city, zip_code, beds, min_baths, max_price, min_price,
        property_type, min_sqft, max_sqft, limit,
    )
    if cached:
        logger.info(f"Cache hit for city={city} — skipping Redfin call")
        # Still enrich any cached properties that are missing schools data
        for prop in cached:
            if "schools" not in (prop.agg_data or {}):
                background_tasks.add_task(_enrich_property, prop.id)
        return cached

    # ── Redfin (free, no API key needed) ─────────────────────────────────────
    try:
        raw_listings = await redfin.search_listings(
            city=city or "",
            state=state,
            beds_min=beds,
            baths_min=min_baths,
            price_min=min_price,
            price_max=max_price,
            property_type=property_type,
            sqft_min=min_sqft,
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
        # Re-enrich if never enriched, or if schools data is missing (added later)
        needs_enrich = (
            prop.last_enriched is None
            or "schools" not in (prop.agg_data or {})
        )
        if needs_enrich:
            background_tasks.add_task(_enrich_property, prop.id)
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


@router.post("/admin/re-enrich-schools")
async def re_enrich_schools(db: AsyncSession = Depends(get_db), background_tasks: BackgroundTasks = None):
    """Re-enrich schools data for all properties."""
    stmt = select(PropertyORM)
    result = await db.execute(stmt)
    props = result.scalars().all()
    count = 0
    for prop in props:
        if (prop.agg_data or {}).get("_redfin_url"):
            background_tasks.add_task(_enrich_property, prop.id)
            count += 1
    return {"queued": count}


@router.post("/admin/preload-cities")
async def preload_cities(background_tasks: BackgroundTasks):
    """Pre-load listings for popular cities in background."""
    popular_cities = [
        ("Miami", "FL"),
        ("Los Angeles", "CA"),
        ("San Jose", "CA"),
        ("Denver", "CO"),
        ("Austin", "TX"),
        ("New York", "NY"),
        ("Phoenix", "AZ"),
        ("Chicago", "IL"),
    ]
    
    async def fetch_city(city: str, state: str):
        from backend.services import redfin
        try:
            listings = await redfin.search_listings(city, state, limit=50)
            logger.info(f"Pre-loaded {len(listings)} listings for {city}, {state}")
        except Exception as e:
            logger.error(f"Failed to pre-load {city}, {state}: {e}")
    
    for city, state in popular_cities:
        background_tasks.add_task(fetch_city, city, state)
    
    return {"queued": len(popular_cities), "cities": popular_cities}
