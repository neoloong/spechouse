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
    components: Dict[str, Optional[float]] = {}

    # 1. Rental yield (20%) — annual rent / list price as a percentage, 0-100
    if list_price and rental_estimate and list_price > 0:
        annual_rent = rental_estimate * 12
        gross_yield_pct = (annual_rent / list_price) * 100
        # 5% yield → 50 (middle), 3% → 25, 8% → 65, 12% → 100
        components["rental_yield"] = _clamp(gross_yield_pct * 8.33)
    else:
        components["rental_yield"] = None

    # 2. Noise (20%) — normalized so typical suburban ~65dB = ~60, quiet ~50dB = ~80
    # Piecewise: <40dB=100, 40-55=80-100, 55-65=60-80, 65-75=30-60, 75+=10-30
    if noise_db is not None:
        if noise_db <= 40:
            noise_score = 100.0
        elif noise_db <= 55:
            noise_score = _clamp(100 + (40 - noise_db) * 1.33)
        elif noise_db <= 65:
            noise_score = _clamp(80 - (noise_db - 55) * 2.0)
        elif noise_db <= 75:
            noise_score = _clamp(60 - (noise_db - 65) * 3.0)
        else:
            noise_score = _clamp(30 - (noise_db - 75) * 2.0)
        components["noise"] = noise_score
    else:
        components["noise"] = None

    # 3. Crime / safety (20%) — crime_score is already safety_score (high = safe)
    # No inversion needed: directly map 0-100 → 0-100
    components["crime"] = _clamp(crime_score) if crime_score is not None else None

    # 4. Price vs AVM (20%)
    if list_price and rentcast_avm and rentcast_avm > 0:
        discount_pct = ((rentcast_avm - list_price) / rentcast_avm) * 100
        components["price_vs_avm"] = _clamp(50 + discount_pct * 2.5)
    else:
        components["price_vs_avm"] = None

    # 5. Price trend (15%)
    if price_trend_pct is not None:
        components["price_trend"] = _clamp(50 - price_trend_pct * 5)
    else:
        components["price_trend"] = None

    # 6. Schools (15%) — closest elementary school GreatSchools rating × 10 (0-100 scale)
    components["schools"] = _school_rating_score(schools) if schools else None

    weights = {
        "rental_yield": 0.20,
        "noise": 0.15,
        "crime": 0.15,
        "price_vs_avm": 0.15,
        "price_trend": 0.10,
        "schools": 0.15,
    }

    # Missing components use 50 (neutral) so one bad signal doesn't
    # dominate the score when noise/crime data isn't available yet.
    weighted_sum = sum(
        (v if v is not None else 50.0) * w
        for v, w in [(components[k], weights[k]) for k in weights]
    )
    overall = round(weighted_sum, 1)

    value_vals = [v for v in [components["price_vs_avm"], components["rental_yield"]] if v is not None]
    value_score = round(sum(value_vals) / len(value_vals), 1) if value_vals else 50.0

    inv_vals = [v for v in [components["rental_yield"], components["price_trend"]] if v is not None]
    investment_score = round(sum(inv_vals) / len(inv_vals), 1) if inv_vals else 50.0

    return {"overall": overall, "value": value_score, "investment": investment_score}


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

    agg["environment"] = {
        "noise_db": noise_data.get("noise_db"),
        "noise_label": noise_data.get("noise_label"),
        "crime_score": crime_safety_score,
        **({"crime_label": crime_data.get("label")} if crime_data.get("label") else {}),
    }

    agg["scores"] = compute_scores(
        list_price=list_price,
        sqft=sqft,
        rental_estimate=rental_estimate,
        noise_db=noise_data.get("noise_db"),
        crime_score=crime_safety_score,
        rentcast_avm=None,
        schools=schools,
    )

    return agg
