"""
Property scoring algorithm — per-city percentile ranking (v2.0).

Design decisions:
1. PER-CITY PERCENTILES: Every sub-component is ranked against other properties
   in the same city. A 4.5% yield in San Francisco (top quartile) scores higher
   than a 6% yield in Chicago (bottom quartile). This eliminates the bias that
   cheap cities always score better than expensive ones.

2. PRD-ALIGNED WEIGHTS: Value 40%, Investment 35%, Environment 25% as specified.

3. FALLBACK TIERS: When a city has < 5 properties, fall back to state-level
   then national-level percentiles. Last resort: linear absolute mapping.

4. CONFIDENCE INDICATOR: Each sub-score reports a margin (±) based on input
   completeness. Scores with < 50% inputs are hidden ("Insufficient data").

5. SCORE RANGE: All scores are 0–10 (10 = best), stored directly at this scale.

6. DISTRIBUTION CACHE: City-level distributions are cached in memory for 15 min
   to avoid querying the DB on every enrichment.
"""
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.property import PropertyORM

logger = logging.getLogger(__name__)

# ── In-memory distribution cache ───────────────────────────────────────────
# Keyed by (city_key, component_name), TTL 15 minutes.
# Avoids re-querying the DB for every property enrichment in the same city batch.

_dist_cache: Dict[str, Tuple[datetime, List[float]]] = {}
_DIST_CACHE_TTL_SECS = 900  # 15 minutes


def _cache_key(city: str, component: str) -> str:
    return f"{(city or '').strip().lower()}:{component}"


def _cached_dist(city: str, component: str) -> Optional[List[float]]:
    key = _cache_key(city, component)
    if key in _dist_cache:
        ts, data = _dist_cache[key]
        if (datetime.utcnow() - ts).total_seconds() < _DIST_CACHE_TTL_SECS:
            return data
        del _dist_cache[key]
    return None


def _set_cached_dist(city: str, component: str, data: List[float]) -> None:
    _dist_cache[_cache_key(city, component)] = (datetime.utcnow(), data)


# ── Percentile computation ─────────────────────────────────────────────────

def _percentile(values: List[float], value: float, higher_is_better: bool = True) -> float:
    """Compute percentile rank (0–100) of value within the population.

    For higher_is_better=True:  count(values <= my_value) / N * 100
    For higher_is_better=False: count(values >= my_value) / N * 100
    (lower raw value is better → count how many are worse/higher)

    Returns 50.0 if population is empty.
    """
    if not values:
        return 50.0

    n = len(values)
    if higher_is_better:
        count = sum(1 for v in values if v <= value)
    else:
        count = sum(1 for v in values if v >= value)
    return (count / n) * 100.0


def _percentile_to_score(percentile: float) -> float:
    """Map percentile (0–100) to 0–10 score. Simple linear mapping."""
    return round(percentile / 10.0, 1)


# ── Distribution queries ───────────────────────────────────────────────────

async def _query_city_distributions(
    db: AsyncSession,
    city: str,
    state: Optional[str] = None,
) -> Dict[str, List[float]]:
    """Gather raw component distributions for all properties in a city.

    Returns dict mapping component_name -> list of float values.
    Components extracted from DB columns and agg_data JSONB.
    """
    # Build filter — prefer city, fall back to state if city has too few
    city_filter = (city or "").strip().lower()

    stmt = select(
        PropertyORM.city,
        PropertyORM.state,
        PropertyORM.list_price,
        PropertyORM.sqft,
        PropertyORM.noise_db,
        PropertyORM.property_tax,
        PropertyORM.agg_data,
    ).where(
        PropertyORM.list_price > 50000,  # valid prices only
        PropertyORM.sqft > 0,
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Group by city for per-city distributions
    city_rows: Dict[str, list] = {}
    for row in rows:
        c = (row.city or "").strip().lower()
        if c not in city_rows:
            city_rows[c] = []
        city_rows[c].append(row)

    # Use the target city's rows, or fall back
    target_rows = city_rows.get(city_filter, [])
    fallback_level = "city"

    if len(target_rows) < 5:
        # Fall back to state level
        state_rows = [
            r for rows_list in city_rows.values()
            for r in rows_list
            if (r.state or "").upper() == (state or "").upper()
        ]
        if len(state_rows) >= 10:
            target_rows = state_rows
            fallback_level = "state"
        else:
            # National fallback
            all_rows = [r for rows_list in city_rows.values() for r in rows_list]
            if len(all_rows) >= 20:
                target_rows = all_rows
                fallback_level = "national"
            else:
                target_rows = []
                fallback_level = "none"

    if not target_rows:
        logger.warning(f"No distribution data for city={city}, state={state}")
        return {}

    logger.info(
        f"Distribution for city={city}: {len(target_rows)} rows "
        f"(fallback={fallback_level})"
    )

    # Extract component values
    rental_yields: List[float] = []
    noise_dbs: List[float] = []
    crime_scores: List[float] = []
    price_per_sqfts: List[float] = []
    tax_burdens: List[float] = []
    discounts: List[float] = []

    for r in target_rows:
        agg = r.agg_data or {}

        # Rental yield from agg_data -> rental -> yield_pct
        rental = agg.get("rental", {})
        yld = rental.get("yield_pct")
        if yld is not None and isinstance(yld, (int, float)):
            # Filter outliers: yields above 50% are almost certainly bad data
            if 0 < yld < 50:
                rental_yields.append(float(yld))

        # Noise from noise_db column
        if r.noise_db is not None:
            noise_dbs.append(float(r.noise_db))

        # Crime from agg_data -> environment -> crime_score
        env = agg.get("environment", {})
        cs = env.get("crime_score")
        if cs is None:
            # Also check agg_data -> crime -> safety_score (older format)
            crime = agg.get("crime", {})
            cs = crime.get("safety_score")
        if cs is not None and isinstance(cs, (int, float)):
            crime_scores.append(float(cs))

        # Price per sqft
        if r.list_price and r.sqft and r.sqft > 0:
            ppsf = float(r.list_price) / float(r.sqft)
            if 50 < ppsf < 5000:  # sanity bounds
                price_per_sqfts.append(ppsf)

        # Tax burden: annual property_tax / list_price
        if r.property_tax and r.list_price and r.list_price > 0:
            tb = float(r.property_tax) / float(r.list_price)
            if 0 < tb < 0.2:  # 0–20% tax rate
                tax_burdens.append(tb)

        # Price discount: for now, use price_per_sqft deviation from city median
        # as a proxy for "under/over valued relative to city average"
        # This replaces the missing RentCast AVM
        discounts.append(0.0)  # placeholder, computed below

    # Compute discounts: each property's price_per_sqft vs city median
    if price_per_sqfts:
        sorted_ppsf = sorted(price_per_sqfts)
        median_ppsf = sorted_ppsf[len(sorted_ppsf) // 2]
        if median_ppsf > 0:
            discounts = [
                ((median_ppsf - ppsf) / median_ppsf) * 100
                for ppsf in price_per_sqfts
            ]

    return {
        "rental_yields": sorted(rental_yields),
        "noise_dbs": sorted(noise_dbs),
        "crime_scores": sorted(crime_scores),
        "price_per_sqfts": sorted(price_per_sqfts),
        "tax_burdens": sorted(tax_burdens),
        "discounts": sorted(discounts),
    }


# ── Scoring engine ─────────────────────────────────────────────────────────

async def compute_scores(
    db: AsyncSession,
    city: Optional[str],
    state: Optional[str],
    list_price: Optional[float],
    sqft: Optional[int],
    rental_yield: Optional[float] = None,
    noise_db: Optional[float] = None,
    crime_score: Optional[float] = None,
    property_tax: Optional[float] = None,
    days_on_market: Optional[int] = None,
    price_cut_count: Optional[int] = None,
    walkability: Optional[float] = None,
) -> Dict:
    """Compute 0–10 per-city percentile scores.

    Weights (per PRD §4.4):
      Value       40%  — price vs city median $/sqft, days on market, price cuts
      Investment  35%  — rental yield, property tax burden
      Environment 25%  — noise quietness, crime safety, walkability

    Each sub-component is ranked against the city's distribution.
    Returns dict with scores at 0–10 scale and confidence margins.
    """
    dist = {}
    if city:
        # Try cache first
        for comp in ("rental_yields", "noise_dbs", "crime_scores",
                      "price_per_sqfts", "tax_burdens", "discounts"):
            cached = _cached_dist(city, comp)
            if cached is not None:
                dist[comp] = cached

        if not dist:
            dist = await _query_city_distributions(db, city, state)
            for comp, values in dist.items():
                _set_cached_dist(city, comp, values)

    def rank(component_key: str, value: Optional[float],
             higher_is_better: bool = True) -> Optional[Tuple[float, float]]:
        """Compute percentile and score for a single value.
        Returns (percentile_0_100, score_0_10) or None if value/dist missing."""
        if value is None:
            return None
        values = dist.get(component_key, [])
        if not values:
            # No distribution data — use neutral score
            return (50.0, 5.0)
        pct = _percentile(values, value, higher_is_better=higher_is_better)
        score = _percentile_to_score(pct)
        return (pct, score)

    # ═══════════════════════════════════════════════════════════════════════
    # VALUE score (40%) — How good is the deal?
    # ═══════════════════════════════════════════════════════════════════════
    value_inputs: List[str] = []
    value_scores: List[float] = []

    # 1. Price vs city median $/sqft (proxy for AVM comparison)
    #    Lower $/sqft = better value → compute discount%
    #    discount% = (city_median_ppsf - property_ppsf) / city_median_ppsf * 100
    if list_price and sqft and sqft > 0:
        ppsf = list_price / sqft
        ppsf_values = dist.get("price_per_sqfts", [])
        if ppsf_values:
            median_ppsf = ppsf_values[len(ppsf_values) // 2]
            if median_ppsf > 0:
                discount_pct = ((median_ppsf - ppsf) / median_ppsf) * 100
                pct, sc = rank("discounts", discount_pct, higher_is_better=True) or (50.0, 5.0)
                value_scores.append(sc)
                value_inputs.append("price_vs_avm")

    # 2. Days on market — lower = better (market velocity)
    if days_on_market is not None:
        # No distribution data yet — use linear scale for now
        # < 7 days = 10, 7-14 = 8, 14-30 = 7, 30-60 = 5, 60-90 = 3, > 90 = 1
        if days_on_market <= 7:
            dom_score = 10.0
        elif days_on_market <= 14:
            dom_score = 8.0
        elif days_on_market <= 30:
            dom_score = 7.0
        elif days_on_market <= 60:
            dom_score = 5.0
        elif days_on_market <= 90:
            dom_score = 3.0
        else:
            dom_score = 1.0
        value_scores.append(dom_score)
        value_inputs.append("market_velocity")

    # 3. Price cut frequency — fewer cuts = better
    if price_cut_count is not None:
        # 0 cuts = 10, 1 = 7, 2 = 4, 3+ = 2
        if price_cut_count == 0:
            pc_score = 10.0
        elif price_cut_count == 1:
            pc_score = 7.0
        elif price_cut_count == 2:
            pc_score = 4.0
        else:
            pc_score = 2.0
        value_scores.append(pc_score)
        value_inputs.append("price_cuts")

    value_score = (round(sum(value_scores) / len(value_scores), 1)
                   if value_scores else None)

    # ═══════════════════════════════════════════════════════════════════════
    # INVESTMENT score (35%) — What's the return?
    # ═══════════════════════════════════════════════════════════════════════
    inv_inputs: List[str] = []
    inv_scores: List[float] = []

    # 1. Rental yield — higher = better
    if rental_yield is not None:
        pct, sc = rank("rental_yields", rental_yield, higher_is_better=True) or (50.0, 5.0)
        inv_scores.append(sc)
        inv_inputs.append("rental_yield")

    # 2. Property tax burden — lower = better
    if property_tax and list_price and list_price > 0:
        tax_burden = property_tax / list_price
        pct, sc = rank("tax_burdens", tax_burden, higher_is_better=False) or (50.0, 5.0)
        inv_scores.append(sc)
        inv_inputs.append("tax_burden")

    # 3. Insurance placeholder — not yet implemented
    #    Will use flood/wildfire risk zones when data is available

    investment_score = (round(sum(inv_scores) / len(inv_scores), 1)
                        if inv_scores else None)

    # ═══════════════════════════════════════════════════════════════════════
    # ENVIRONMENT score (25%) — What's it like to live there?
    # ═══════════════════════════════════════════════════════════════════════
    env_inputs: List[str] = []
    env_scores: List[float] = []

    # 1. Noise quietness — lower dB = better
    if noise_db is not None:
        pct, sc = rank("noise_dbs", noise_db, higher_is_better=False) or (50.0, 5.0)
        env_scores.append(sc)
        env_inputs.append("noise")

    # 2. Crime safety — higher = safer
    if crime_score is not None:
        pct, sc = rank("crime_scores", crime_score, higher_is_better=True) or (50.0, 5.0)
        env_scores.append(sc)
        env_inputs.append("crime")

    # 3. Walkability placeholder — not yet implemented
    if walkability is not None:
        env_scores.append(walkability)  # already 0-10 from Walkscore API
        env_inputs.append("walkability")

    # 4. Flood/wildfire risk placeholder — not yet implemented
    #    Structure ready: future FEMA/First Street data can be plugged in here

    environment_score = (round(sum(env_scores) / len(env_scores), 1)
                         if env_scores else None)

    # ═══════════════════════════════════════════════════════════════════════
    # OVERALL composite
    # ═══════════════════════════════════════════════════════════════════════
    weights = {"value": 0.40, "investment": 0.35, "environment": 0.25}

    components = {
        "value": value_score,
        "investment": investment_score,
        "environment": environment_score,
    }

    available = {k: v for k, v in components.items() if v is not None}
    if available:
        total_weight = sum(weights[k] for k in available)
        overall = sum(v * (weights[k] / total_weight) for k, v in available.items())
        overall = round(overall, 1)
    else:
        overall = None

    # ═══════════════════════════════════════════════════════════════════════
    # CONFIDENCE margins
    # ═══════════════════════════════════════════════════════════════════════
    expected_inputs = {
        "value": 3,         # price_vs_avm, market_velocity, price_cuts
        "investment": 2,    # rental_yield, tax_burden (+ insurance future)
        "environment": 2,   # noise, crime (+ walkability, flood future)
    }
    actual_inputs = {
        "value": len(value_inputs),
        "investment": len(inv_inputs),
        "environment": len(env_inputs),
    }

    def _margin(ratio: float) -> Optional[float]:
        """Compute ± margin based on input completeness ratio."""
        if ratio >= 1.0:
            return 0.2
        elif ratio >= 0.75:
            return 0.5
        elif ratio >= 0.5:
            return 1.0
        else:
            return None  # insufficient data

    confidences = {}
    for cat in expected_inputs:
        exp = expected_inputs[cat]
        act = actual_inputs[cat]
        ratio = act / exp if exp > 0 else 0
        m = _margin(ratio)
        confidences[cat] = {
            "margin": m,
            "ratio": round(ratio, 2),
            "available": act,
            "expected": exp,
            "sufficient": m is not None,  # > 50% threshold
        }

    # Overall confidence: average of sub-score margins (only for sufficient ones)
    overall_margins = [
        confidences[cat]["margin"]
        for cat in confidences
        if confidences[cat]["margin"] is not None
    ]
    overall_margin = (round(sum(overall_margins) / len(overall_margins), 1)
                      if overall_margins else None)

    return {
        "overall": overall,
        "value": value_score,
        "investment": investment_score,
        "environment": environment_score,
        "confidence_margin": overall_margin,
        "confidence": confidences,
        "components_detail": {
            "value": value_inputs,
            "investment": inv_inputs,
            "environment": env_inputs,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# Enrichment
# ═══════════════════════════════════════════════════════════════════════════

# RentCast API key
_rentcast_key: Optional[str] = None


def _get_rentcast_key() -> Optional[str]:
    global _rentcast_key
    if _rentcast_key is None:
        try:
            from backend.config import settings
            _rentcast_key = getattr(settings, "RENTCAST_API_KEY", "") or None
        except Exception:
            _rentcast_key = None
    return _rentcast_key


def _school_rating_score(schools: list) -> Optional[float]:
    """Extract best available school rating from school data.
    Returns 0-10 score or None."""
    if not schools:
        return None
    ratings = [s["rating"] for s in schools if s.get("rating") is not None]
    return max(ratings) if ratings else None


async def _get_rental_estimate(
    address: Optional[str],
    zip_code: Optional[str],
    city: Optional[str],
    state: Optional[str],
    beds: Optional[int],
    baths: Optional[float],
    sqft: Optional[int],
    property_type: Optional[str],
) -> Optional[float]:
    """Try RentCast (property-level) first, fall back to HUD FMR (free, coarse)."""
    from backend.services import rentcast
    from backend.services.hud_fmr import get_rent_estimate

    key = _get_rentcast_key()
    if key:
        try:
            result = await rentcast.get_rental_estimate(
                address=address, zip_code=zip_code, beds=beds,
                baths=baths, sqft=sqft, property_type=property_type,
            )
            if result and "rent" in result:
                return float(result["rent"])
        except Exception as e:
            logger.warning(f"RentCast failed ({e}), falling back to HUD FMR")

    return get_rent_estimate(city=city, state=state, beds=beds)


async def enrich_agg_data(
    db: AsyncSession,
    current_agg: dict,
    list_price: Optional[float],
    sqft: Optional[int],
    noise_data: dict,
    crime_data: Optional[dict] = None,
    schools: Optional[list] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    beds: Optional[int] = None,
    bathrooms: Optional[float] = None,
    property_type: Optional[str] = None,
    address: Optional[str] = None,
    zip_code: Optional[str] = None,
    days_on_market: Optional[int] = None,
    price_cut_count: Optional[int] = None,
    walkability: Optional[float] = None,
) -> dict:
    """Enrich agg data with rental estimates and per-city percentile scores.

    New in v2.0:
    - Scores are 0–10 per-city percentile ranks
    - Confidence margins indicate data completeness
    - Distribution cache avoids re-querying the DB
    """
    agg = dict(current_agg)

    # ── Rental estimate (3-tier priority) ─────────────────────────────────
    rental_estimate: Optional[float] = None
    source = "—"

    is_multi_family = property_type and "multi" in property_type.lower()

    # 1. Try RentCast API
    key = _get_rentcast_key()
    if key:
        try:
            from backend.services import rentcast
            result = await rentcast.get_rental_estimate(
                address=address, zip_code=zip_code, beds=beds,
                baths=bathrooms, sqft=sqft, property_type=property_type,
            )
            if result and "rent" in result:
                rental_estimate = float(result["rent"])
                source = "RentCast"
        except Exception as e:
            logger.warning(f"RentCast error: {e}")

    # 2. Fall back to self-built rental model (Zillow medians)
    if not rental_estimate:
        try:
            if is_multi_family:
                from backend.services.rental_model import estimate_rent_multi_family
                rental_estimate = estimate_rent_multi_family(
                    list_price=list_price, sqft=sqft, beds=beds,
                    city=city, state=state,
                )
                if rental_estimate:
                    source = "Multi-Family Model"
            else:
                from backend.services.rental_model import estimate_rent
                rental_estimate = estimate_rent(
                    list_price=list_price, sqft=sqft, beds=beds,
                    city=city, state=state,
                )
                if rental_estimate:
                    source = "Price-to-Rent Model"
        except Exception as e:
            logger.debug(f"Rental model error: {e}")

    # 3. Last resort: HUD FMR
    if not rental_estimate:
        from backend.services.hud_fmr import get_rent_estimate
        rental_estimate = get_rent_estimate(city=city, state=state, beds=beds)
        source = "HUD FY2024 FMR"

    # ── City median benchmark ──────────────────────────────────────────────
    zillow_city_median: Optional[float] = None
    try:
        from backend.services.rental_model import _CITY_RENTS
        city_key = (city or "").strip().lower()
        neighborhood_map = {
            "santa monica": "los angeles", "berkeley": "oakland",
            "palo alto": "san jose", "mountain view": "san jose",
            "sunnyvale": "san jose", "cupertino": "san jose",
            "fremont": "oakland",
            "manhattan": "new york", "brooklyn": "new york",
            "queens": "new york", "bronx": "new york",
        }
        parent_city = neighborhood_map.get(city_key, city_key)
        if parent_city in _CITY_RENTS and beds is not None:
            br_key = max(0, min(beds, 4))
            zillow_city_median = _CITY_RENTS[parent_city].get(br_key)
    except Exception:
        pass

    # ── Compute rental yield ───────────────────────────────────────────────
    rental_yield = None
    if list_price and rental_estimate and list_price > 0:
        annual_rent = rental_estimate * 12
        rental_yield = round((annual_rent / list_price) * 100, 2)

    agg["rental"] = {
        "estimate": rental_estimate,
        "yield_pct": rental_yield,
        "cap_rate": rental_yield,  # same as yield for simplified cap rate
        "source": source,
        "zillow_city_median": zillow_city_median,
    }

    # ── Extract crime safety score ─────────────────────────────────────────
    crime_safety_score: Optional[float] = None
    if crime_data:
        crime_safety_score = crime_data.get("safety_score")

    # ── Extract noise ──────────────────────────────────────────────────────
    noise_db = noise_data.get("noise_db")

    # ── Compute per-city percentile scores ─────────────────────────────────
    scores = await compute_scores(
        db=db,
        city=city,
        state=state,
        list_price=list_price,
        sqft=sqft,
        rental_yield=rental_yield,
        noise_db=noise_db,
        crime_score=crime_safety_score,
        property_tax=current_agg.get("property_tax"),
        days_on_market=days_on_market,
        price_cut_count=price_cut_count,
        walkability=walkability,
    )

    agg["scores"] = scores

    # ── Environment section ────────────────────────────────────────────────
    agg["environment"] = {
        "noise_db": noise_db,
        "noise_label": noise_data.get("noise_label"),
        "noise_detail": noise_data.get("noise_detail"),
        "noise_score": scores.get("environment"),  # already 0-10
        "crime_score": crime_safety_score,
        **({"crime_label": crime_data.get("label")}
           if crime_data and crime_data.get("label") else {}),
    }

    # ── Schools ────────────────────────────────────────────────────────────
    if schools:
        agg["schools"] = schools
        school_score = _school_rating_score(schools)
        if school_score is not None:
            agg["school_summary"] = {"rating": school_score}

    return agg
