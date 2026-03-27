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


def compute_scores(
    list_price: Optional[float],
    sqft: Optional[int],
    rental_estimate: Optional[float],
    noise_db: Optional[float],
    crime_score: Optional[float],
    rentcast_avm: Optional[float],
    price_trend_pct: Optional[float] = None,
) -> Dict[str, float]:
    components: Dict[str, Optional[float]] = {}

    # 1. Rental yield (25%)
    if list_price and rental_estimate and list_price > 0:
        annual_rent = rental_estimate * 12
        gross_yield = (annual_rent / list_price) * 100
        components["rental_yield"] = _clamp(gross_yield / 12 * 100)
    else:
        components["rental_yield"] = None

    # 2. Noise inverted (20%)
    components["noise"] = _clamp(100 - noise_db) if noise_db is not None else None

    # 3. Crime inverted (20%)
    components["crime"] = _clamp(100 - crime_score) if crime_score is not None else None

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

    weights = {
        "rental_yield": 0.25,
        "noise": 0.20,
        "crime": 0.20,
        "price_vs_avm": 0.20,
        "price_trend": 0.15,
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
    city: Optional[str] = None,
    state: Optional[str] = None,
    beds: Optional[int] = None,
) -> dict:
    agg = dict(current_agg)

    # ── Rental estimate (3-tier priority) ───────────────────────────────────
    # 1. RentCast API (property-level, accurate) — if key configured
    # 2. Self-built price-to-rent model (Redfin-derived, no API needed)
    # 3. HUD FMR (coarse metro-level, always free)
    rental_estimate: Optional[float] = None
    source = "—"

    key = _get_rentcast_key()
    if key:
        try:
            from backend.services import rentcast
            result = await rentcast.get_rental_estimate(
                address=None, zip_code=None, beds=beds,
                baths=None, sqft=sqft, property_type=None,
            )
            rental_estimate = float(result["rent"]) if result and "rent" in result else None
        except Exception as e:
            logger.warning(f"RentCast error: {e}")

    if not rental_estimate:
        try:
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
    }

    agg["environment"] = {
        "noise_db": noise_data.get("noise_db"),
        "noise_label": noise_data.get("noise_label"),
        "crime_score": None,
    }

    agg["scores"] = compute_scores(
        list_price=list_price,
        sqft=sqft,
        rental_estimate=rental_estimate,
        noise_db=noise_data.get("noise_db"),
        crime_score=None,
        rentcast_avm=None,
    )

    return agg
