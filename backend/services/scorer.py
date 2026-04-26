"""Property score algorithm (0–100 composite)."""
import logging
from typing import Optional, Dict
from backend.services.hud_fmr import get_rent_estimate

logger = logging.getLogger(__name__)

# RentCast API key — set in backend/.env (free tier: 500 calls/month)
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


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _noise_score(noise_db: Optional[float]) -> Optional[float]:
    """Convert dB reading to 0-100 quietness score.
    Lower dB = quieter = higher score."""
    if noise_db is None:
        return None
    # Piecewise linear: 40dB=100, 55dB=80, 65dB=60, 75dB=30, 85dB=10
    if noise_db <= 40:
        return 100.0
    elif noise_db <= 55:
        return _clamp(100 + (40 - noise_db) * 1.33)
    elif noise_db <= 65:
        return _clamp(80 - (noise_db - 55) * 2.0)
    elif noise_db <= 75:
        return _clamp(60 - (noise_db - 65) * 3.0)
    else:
        return _clamp(30 - (noise_db - 75) * 2.0)


def _school_rating_score(schools: list) -> Optional[float]:
    """Convert GreatSchools ratings (1-10) to 0-100 score.
    Uses the closest elementary school rating if available,
    otherwise the best available school rating."""
    if not schools:
        return None
    # Priority: elementary > middle > high
    level_order = ["elementary", "middle", "high"]
    for level in level_order:
        for s in schools:
            if s.get("type") == level and s.get("rating") is not None:
                return float(s["rating"]) * 10  # 1-10 → 0-100
    # Fallback: best available rating
    ratings = [s["rating"] * 10 for s in schools if s.get("rating") is not None]
    return max(ratings) if ratings else None


def compute_scores(
    list_price: Optional[float],
    sqft: Optional[int],
    rental_estimate: Optional[float],
    noise_db: Optional[float],
    crime_score: Optional[float],
    rentcast_avm: Optional[float],
    price_trend_pct: Optional[float] = None,
    schools: Optional[list] = None,
) -> Dict[str, float]:
    """
    Score algorithm — only scores dimensions with real data.
    Missing signals are excluded (not penalised with neutral 50).
    Returns 0-100 scale per dimension and composite.
    """
    components: Dict[str, Optional[float]] = {}

    # 1. Rental yield — annual rent / list price as a percentage → 0-100
    # Scale: 3% yield=25, 5%=42, 7%=58, 10%=83, 12%+=100
    if list_price and rental_estimate and list_price > 0:
        annual_rent = rental_estimate * 12
        gross_yield_pct = (annual_rent / list_price) * 100
        components["rental_yield"] = _clamp(gross_yield_pct * 9.1 - 2.7)

    # 2. Noise — lower dB = higher score (quieter)
    # <40dB=100, 40-55=80-100, 55-65=60-80, 65-75=30-60, 75+=10-30
    if noise_db is not None:
        if noise_db <= 40:
            components["noise"] = 100.0
        elif noise_db <= 55:
            components["noise"] = _clamp(100 + (40 - noise_db) * 1.33)
        elif noise_db <= 65:
            components["noise"] = _clamp(80 - (noise_db - 55) * 2.0)
        elif noise_db <= 75:
            components["noise"] = _clamp(60 - (noise_db - 65) * 3.0)
        else:
            components["noise"] = _clamp(30 - (noise_db - 75) * 2.0)

    # 3. Crime safety — crime_score is already 0-100 (high = safe)
    if crime_score is not None:
        components["crime"] = _clamp(crime_score)

    # 4. Price vs AVM — how much below market value
    if list_price and rentcast_avm and rentcast_avm > 0:
        discount_pct = ((rentcast_avm - list_price) / rentcast_avm) * 100
        # -10% below market = 75, at market = 50, 10% above = 25
        components["price_vs_avm"] = _clamp(50 + discount_pct * 2.5)

    # 5. Price trend — positive trend = lower score (overpriced)
    if price_trend_pct is not None:
        components["price_trend"] = _clamp(50 - price_trend_pct * 5)

    # 6. Schools — elementary GreatSchools rating × 10
    school_score = _school_rating_score(schools)
    if school_score is not None:
        components["schools"] = school_score

    # ── Composite: weighted average of available signals only ─────────────────
    weights = {
        "rental_yield": 0.25,
        "noise": 0.15,
        "crime": 0.20,
        "price_vs_avm": 0.15,
        "price_trend": 0.10,
        "schools": 0.15,
    }

    available = {k: components[k] for k in components if components[k] is not None}
    if available:
        total_weight = sum(weights[k] for k in available)
        # Normalise weights to sum to 1.0
        overall = sum(v * (weights[k] / total_weight) for k, v in available.items())
        overall = round(_clamp(overall), 1)
    else:
        overall = None

    # Value score: rental yield + price vs AVM
    value_vals = [components[k] for k in ["price_vs_avm", "rental_yield"] if components.get(k) is not None]
    value_score = round(sum(value_vals) / len(value_vals), 1) if value_vals else None

    # Investment score: rental yield + price trend
    inv_vals = [components[k] for k in ["rental_yield", "price_trend"] if components.get(k) is not None]
    investment_score = round(sum(inv_vals) / len(inv_vals), 1) if inv_vals else None

    # Environment score: noise + crime
    env_vals = [components[k] for k in ["noise", "crime"] if components.get(k) is not None]
    environment_score = round(sum(env_vals) / len(env_vals), 1) if env_vals else None

    return {
        "overall": overall if overall is not None else 50.0,
        "value": value_score if value_score is not None else 50.0,
        "investment": investment_score if investment_score is not None else 50.0,
        "environment": environment_score if environment_score is not None else 50.0,
        "noise": components.get("noise"),
        "crime": components.get("crime"),
    }


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
    import asyncio
    from backend.services import rentcast

    key = _get_rentcast_key()
    if key:
        try:
            result = await rentcast.get_rental_estimate(
                address=address,
                zip_code=zip_code,
                beds=beds,
                baths=baths,
                sqft=sqft,
                property_type=property_type,
            )
            if result and "rent" in result:
                return float(result["rent"])
        except Exception as e:
            logger.warning(f"RentCast failed ({e}), falling back to HUD FMR")

    # Free fallback: HUD FMR coarse city-level estimate
    return get_rent_estimate(city=city, state=state, beds=beds)


async def enrich_agg_data(
    current_agg: dict,
    list_price: Optional[float],
    sqft: Optional[int],
    noise_data: dict,
    crime_data: Optional[dict] = None,
    schools: Optional[list] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    beds: Optional[int] = None,
    property_type: Optional[str] = None,
) -> dict:
    """Enrich agg data with rental estimates, environment (noise_db, crime), and scores.

    noise_db is extracted from noise_data and passed to compute_scores() for scoring.
    """
    agg = dict(current_agg)

    # ── Rental estimate (3-tier priority) ───────────────────────────────────
    # 1. RentCast API (property-level, accurate) — if key configured
    # 2. Self-built Zillow city median rent model (no API needed)
    # 3. HUD FMR (coarse metro-level, always free)
    rental_estimate: Optional[float] = None
    source = "—"

    is_multi_family = property_type and "multi" in property_type.lower()

    key = _get_rentcast_key()
    if key:
        try:
            from backend.services import rentcast
            result = await rentcast.get_rental_estimate(
                address=None, zip_code=None, beds=beds,
                baths=None, sqft=sqft, property_type=property_type,
            )
            rental_estimate = float(result["rent"]) if result and "rent" in result else None
        except Exception as e:
            logger.warning(f"RentCast error: {e}")

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
                    list_price=list_price,
                    sqft=sqft,
                    beds=beds,
                    city=city,
                    state=state,
                )
                if rental_estimate:
                    source = "Price-to-Rent Model"
        except Exception as e:
            logger.debug(f"Rental model error: {e}")

    # ── City median benchmark (Zillow Q1 2025) ─────────────────────────────────
    # Always include the city median for this bedroom count as a benchmark
    zillow_city_median: Optional[float] = None
    try:
        from backend.services.rental_model import _CITY_RENTS
        city_key = (city or "").strip().lower()
        # Resolve neighborhood → parent city
        neighborhood_map = {
            "santa monica": "los angeles",
            "berkeley": "oakland",
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

    if not rental_estimate:
        rental_estimate = get_rent_estimate(city=city, state=state, beds=beds)
        source = "HUD FY2024 FMR"

    rental_yield = None
    cap_rate = None
    if list_price and rental_estimate and list_price > 0:
        annual_rent = rental_estimate * 12
        rental_yield = round((annual_rent / list_price) * 100, 2)
        cap_rate = rental_yield

    agg["rental"] = {
        "estimate": rental_estimate,
        "yield_pct": rental_yield,
        "cap_rate": cap_rate,
        "source": source,
        "zillow_city_median": zillow_city_median,
    }

    # Extract crime safety score (high = safe, from city/FBI data)
    crime_safety_score: Optional[float] = None
    if crime_data:
        crime_safety_score = crime_data.get("safety_score")

    agg["scores"] = compute_scores(
        list_price=list_price,
        sqft=sqft,
        rental_estimate=rental_estimate,
        noise_db=noise_data.get("noise_db"),
        crime_score=crime_safety_score,
        rentcast_avm=None,
        schools=schools,
    )

    # Extract noise_score from computed scores (0-100 quietness, higher = quieter)
    noise_score = agg["scores"].get("noise")

    agg["environment"] = {
        "noise_db": noise_data.get("noise_db"),
        "noise_label": noise_data.get("noise_label"),
        "noise_detail": noise_data.get("noise_detail"),
        "noise_score": noise_score,
        "crime_score": crime_safety_score,
        **({"crime_label": crime_data.get("label")} if crime_data and crime_data.get("label") else {}),
    }

    return agg
