"""Property score algorithm (0–100 composite)."""
from typing import Optional, Dict
from backend.services.hud_fmr import get_rent_estimate


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


def enrich_agg_data(
    current_agg: dict,
    list_price: Optional[float],
    sqft: Optional[int],
    noise_data: dict,
    city: Optional[str] = None,
    state: Optional[str] = None,
    beds: Optional[int] = None,
) -> dict:
    agg = dict(current_agg)

    # Free rental estimate — HUD FMR, zero API calls
    rental_estimate = get_rent_estimate(city=city, state=state, beds=beds)

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
        "source": "HUD FY2024 FMR",
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
