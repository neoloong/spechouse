"""Property search and detail endpoints."""
from typing import Optional, List
import asyncio
import hashlib
import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from datetime import datetime

from backend.db import get_db, SessionLocal
from backend.models.property import PropertyORM, PropertyListItem, PropertyOut
from backend.services import howloud, scorer, redfin, schools as schools_svc, crime as crime_svc
from backend.services.mock_data import MOCK_PROPERTIES, MOCK_AGG
from backend.config import settings
from backend.routers.deps import require_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/properties", tags=["properties"])


def _use_mock() -> bool:
    return str(getattr(settings, "USE_MOCK_DATA", "")).lower() == "true"


# ── Short-TTL in-memory cache: avoids hammering Redfin/Nominatim ──────────────
# 5-minute TTL — stale enough to reduce API calls, fresh enough to show new listings
_SEARCH_CACHE_TTL_SECS = 300

_search_cache: dict[str, tuple[float, List[dict]]] = {}


def _search_cache_key(
    city: Optional[str],
    state: Optional[str],
    zip_code: Optional[str],
    beds: Optional[int],
    min_baths: Optional[float],
    max_price: Optional[float],
    min_price: Optional[float],
    property_type: Optional[str],
    min_sqft: Optional[int],
    max_sqft: Optional[int],
    limit: int,
) -> str:
    """Deterministic cache key for a search request."""
    parts = [
        city or "", state or "", zip_code or "",
        str(beds or ""), str(min_baths or ""), str(max_price or ""),
        str(min_price or ""), property_type or "", str(min_sqft or ""),
        str(max_sqft or ""), str(limit),
    ]
    return hashlib.md5("|".join(parts).encode()).hexdigest()


def _get_cached(city: str, **kwargs) -> Optional[List[dict]]:
    """Return cached Redfin results if still fresh (< 5 min old)."""
    key = _search_cache_key(city=city, **kwargs)
    if key in _search_cache:
        ts, data = _search_cache[key]
        if time.time() - ts < _SEARCH_CACHE_TTL_SECS:
            logger.info(f"Search cache hit for city={city} (age={time.time()-ts:.0f}s)")
            return data
        else:
            del _search_cache[key]
    return None


def _set_cached(city: str, data: List[dict], **kwargs) -> None:
    key = _search_cache_key(city=city, **kwargs)
    _search_cache[key] = (time.time(), data)
    logger.info(f"Search cache set for city={city}, {len(data)} listings, TTL={_SEARCH_CACHE_TTL_SECS}s")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _upsert_property(db: AsyncSession, data: dict) -> PropertyORM:
    # Pull out non-ORM fields before processing
    redfin_url = data.pop("_redfin_url", None)

    list_price = data.get("list_price")
    sqft = data.get("sqft")
    beds = data.get("beds")

    # Guard: skip listings with obviously bad price data
    if list_price is not None and list_price < _MIN_PRICE:
        logger.warning(f"Skipping low-price scrape error: {data.get('external_id')} ${list_price}")
        return None

    # Guard: skip listings with beds=0 AND suspiciously large sqft (scrape error)
    if beds == 0 and sqft and sqft > 5000:
        logger.warning(f"Skipping beds=0/sqft scrape error: {data.get('external_id')} sqft={sqft}")
        return None

    # Guard: skip listings with unrealistically low $/sqft
    if list_price and sqft and (list_price / sqft) < _MIN_PRICE_PER_SQFT:
        logger.warning(f"Skipping low $/sqft error: {data.get('external_id')} ${list_price}/{sqft}sqft")
        return None

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
                # Don't overwrite photo_url/photos if already fetched
                if k in ("photo_url", "photos") and getattr(prop, k):
                    continue
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

# Min price-per-sqft: skip listings where $/sqft is unrealistically low.
# Catches Redfin scrape errors where building sqft gets assigned to a unit.
_MIN_PRICE_PER_SQFT = 50


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

        # Skip listings with beds=0 AND suspiciously large sqft (scrape error)
        if prop.beds == 0 and prop.sqft and prop.sqft > 5000:
            logger.warning(f"Skipping likely scrape error: id={prop_id} beds=0 sqft={prop.sqft}")
            await db.execute(
                update(PropertyORM)
                .where(PropertyORM.id == prop_id)
                .values(last_enriched=datetime.utcnow())
            )
            await db.commit()
            return

        # Skip listings with unrealistically low price-per-sqft (scrape error)
        if prop.list_price and prop.sqft and (prop.list_price / prop.sqft) < _MIN_PRICE_PER_SQFT:
            logger.warning(f"Skipping low $/sqft scrape error: id={prop_id} ${prop.list_price}/{prop.sqft}sqft")
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
            crime_data=crime_data,
            schools=schools_data,
            city=prop.city,
            state=prop.state,
            beds=prop.beds,
            property_type=prop.property_type,
        )
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

        # Only update noise_db if we got actual data (don't overwrite with None on API failure)
        update_values = {
            "agg_data": new_agg,
            "last_enriched": datetime.utcnow(),
            "photo_url": photo_url,
            "photos": photos,
        }
        if noise_data.get("noise_db") is not None:
            update_values["noise_db"] = noise_data["noise_db"]

        await db.execute(
            update(PropertyORM)
            .where(PropertyORM.id == prop_id)
            .values(**update_values)
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



def _normalize_agg_scores(prop):
    """Normalize score values in agg_data from 0-100 to 0-10 for API responses."""
    def _to_10(v):
        if v is None:
            return None
        return round(float(v) * 0.1, 1)

    agg = prop.agg_data or {}
    if not agg:
        return

    scores = agg.get("scores")
    if scores:
        agg["scores"] = {k: _to_10(v) for k, v in (scores or {}).items()}

    env = agg.get("environment")
    if env:
        if env.get("noise_score") is not None:
            env["noise_score"] = _to_10(env["noise_score"])
        if env.get("crime_score") is not None:
            env["crime_score"] = _to_10(env["crime_score"])


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
            if prop is None:
                continue
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

    # ── Always fetch fresh from Redfin (cached 5 min to avoid hammering API) ─────
    cache_kwargs = dict(
        city=city or "", state=state, zip_code=zip_code,
        beds=beds, min_baths=min_baths, max_price=max_price,
        min_price=min_price, property_type=property_type,
        min_sqft=min_sqft, max_sqft=max_sqft, limit=limit,
    )

    raw_listings = _get_cached(**cache_kwargs)
    cache_hit = raw_listings is not None

    if not cache_hit:
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

        # Cache raw Redfin results for 5 minutes
        _set_cached(**cache_kwargs, data=raw_listings)

    # Upsert all results into DB (enables enrichment, shared across searches)
    props = []
    for parsed in raw_listings:
        if not parsed.get("external_id"):
            continue
        prop = await _upsert_property(db, parsed)
        if prop is None:
            continue  # filtered out by guard in _upsert_property
        # Re-enrich if never enriched, or if schools data is missing (added later)
        needs_enrich = (
            prop.last_enriched is None
            or "schools" not in (prop.agg_data or {})
        )
        if needs_enrich:
            background_tasks.add_task(_enrich_property, prop.id)
        props.append(prop)

    # Filter in-memory results to match exact search params (DB upsert stores broader city data)
    if beds:
        props = [p for p in props if (p.beds or 0) >= beds]
    if min_baths:
        props = [p for p in props if (p.baths or 0) >= min_baths]
    if max_price:
        props = [p for p in props if (p.list_price or 0) <= max_price]
    if min_price:
        props = [p for p in props if (p.list_price or 0) >= min_price]
    if min_sqft:
        props = [p for p in props if (p.sqft or 0) >= min_sqft]

    # Normalize scores in agg_data from 0-100 to 0-10 for API response
    for p in props:
        _normalize_agg_scores(p)

    return props[:limit]



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

    # Normalize agg_data scores from 0-100 to 0-10 and map to top-level fields
    _normalize_agg_scores(prop)
    agg_data = prop.agg_data or {}
    scores = agg_data.get("scores", {}) or {}
    env_data = agg_data.get("environment", {}) or {}

    prop.score_overall = scores.get("overall")
    prop.score_value = scores.get("value")
    prop.score_investment = scores.get("investment")
    prop.score_environment = scores.get("environment")

    prop.score_confidence = None

    # Map rental data to top-level fields
    rental_data = agg_data.get("rental", {}) or {}
    prop.cap_rate = rental_data.get("cap_rate")
    prop.rental_yield_pct = rental_data.get("yield_pct")

    return prop


@router.post("/admin/re-enrich-schools", dependencies=[Depends(require_api_key)])
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


@router.post("/admin/preload-cities", dependencies=[Depends(require_api_key)])
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
