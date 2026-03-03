"""Crime data from city open data APIs (Socrata) — real incidents near a lat/lng."""
import httpx
from datetime import datetime, timedelta
from typing import Optional

# City → Socrata dataset config
CITY_DATASETS = {
    # SF: San Francisco Police Incident Reports
    "san francisco": {
        "url": "https://data.sfgov.org/resource/wg3w-h783.json",
        "lat_field": "point",
        "category_field": "incident_category",
        "violent_categories": {"Assault", "Robbery", "Homicide", "Rape", "Human Trafficking"},
    },
    # Austin: Austin Police Incident Reports
    "austin": {
        "url": "https://data.austintexas.gov/resource/fdj4-gpfu.json",
        "lat_field": "location",
        "category_field": "highest_offense_description",
        "violent_categories": {"MURDER", "RAPE", "ROBBERY", "AGG ASSAULT", "ASSAULT W/INJURY"},
    },
}

RADIUS_METERS = 800  # ~0.5 mile radius
DAYS_BACK = 365


def _safety_label(score: int) -> str:
    if score >= 70:
        return "Low"
    if score >= 50:
        return "Moderate"
    if score >= 30:
        return "High"
    return "Very High"


def _score_from_counts(violent: int, total: int) -> int:
    """Convert yearly crime counts in 0.5mi radius to 0-100 safety score."""
    # Rough benchmarks per year in 0.5mi radius:
    # Urban average: ~50 violent, ~300 total
    # Low crime: <20 violent, <100 total
    # High crime: >100 violent, >600 total
    v_score = max(0, min(100, int(100 - (violent / 80) * 50)))
    t_score = max(0, min(100, int(100 - (total / 400) * 50)))
    return int(v_score * 0.6 + t_score * 0.4)


async def get_crime_score(
    lat: float, lon: float, city: str, state: str
) -> Optional[dict]:
    """Query city open data for crimes within RADIUS_METERS of lat/lng.
    Falls back to state-level FBI data if city not supported."""
    city_key = city.lower().strip() if city else ""
    dataset = CITY_DATASETS.get(city_key)
    if not dataset:
        # Fallback to state-level estimate
        return await get_state_crime_fallback(state)

    since = (datetime.utcnow() - timedelta(days=DAYS_BACK)).strftime("%Y-%m-%dT00:00:00.000")

    params = {
        "$where": f"within_circle({dataset['lat_field']},{lat},{lon},{RADIUS_METERS})",
        "$limit": 1000,
        "$select": dataset["category_field"],
        "$where": f"within_circle({dataset['lat_field']},{lat},{lon},{RADIUS_METERS})",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(dataset["url"], params=params)
            resp.raise_for_status()
            incidents = resp.json()
    except Exception:
        return None

    if not incidents:
        return None

    violent_cats = dataset["violent_categories"]
    cat_field = dataset["category_field"]

    total = len(incidents)
    violent = sum(
        1 for inc in incidents
        if any(v.lower() in str(inc.get(cat_field, "")).lower() for v in violent_cats)
    )

    safety_score = _score_from_counts(violent, total)
    label = _safety_label(safety_score)

    return {
        "safety_score": safety_score,
        "label": label,
        "violent_count": violent,
        "total_count": total,
        "radius_miles": 0.5,
        "period_days": DAYS_BACK,
        "source": "City Open Data",
    }


# State-level crime rate fallback (FBI UCR 2022 data per 100k)
FBI_STATE_RATES = {
    "WA": {"violent": 339.0, "property": 2219.0},
    "CA": {"violent": 442.0, "property": 2081.0},
    "TX": {"violent": 410.0, "property": 2399.0},
    "NY": {"violent": 376.0, "property": 1590.0},
    "FL": {"violent": 389.0, "property": 1891.0},
    "WA": {"violent": 339.0, "property": 2219.0},
    "OR": {"violent": 286.0, "property": 2492.0},
    "AZ": {"violent": 410.0, "property": 2481.0},
    "CO": {"violent": 415.0, "property": 2439.0},
    "NV": {"violent": 541.0, "property": 2017.0},
    "IL": {"violent": 474.0, "property": 1833.0},
    "PA": {"violent": 334.0, "property": 1500.0},
    "OH": {"violent": 343.0, "property": 1893.0},
    "GA": {"violent": 416.0, "property": 2178.0},
    "NC": {"violent": 377.0, "property": 2131.0},
    "NJ": {"violent": 245.0, "property": 1283.0},
    "VA": {"violent": 208.0, "property": 1519.0},
    "MA": {"violent": 365.0, "property": 1234.0},
    "TN": {"violent": 594.0, "property": 2434.0},
    "MI": {"violent": 449.0, "property": 1811.0},
}

NATIONAL_VIOLENT = 380.7
NATIONAL_PROPERTY = 1954.4


async def get_state_crime_fallback(state: str) -> Optional[dict]:
    """Return estimated crime data from state-level FBI stats."""
    abbr = state.upper().strip() if state else None
    if not abbr or abbr not in FBI_STATE_RATES:
        abbr = "CA"  # default fallback

    rates = FBI_STATE_RATES.get(abbr, {"violent": NATIONAL_VIOLENT, "property": NATIONAL_PROPERTY})

    # Convert state rate to an approximate "0.5mi radius" estimate
    # State rate is per 100k, assume ~5000 people in 0.5mi radius urban area
    # This is a rough approximation
    est_violent = int(rates["violent"] * 0.05)
    est_total = int(rates["property"] * 0.05)

    v_score = max(0, min(100, int(100 - (rates["violent"] / NATIONAL_VIOLENT) * 50)))
    t_score = max(0, min(100, int(100 - (rates["property"] / NATIONAL_PROPERTY) * 50)))
    safety_score = int(v_score * 0.6 + t_score * 0.4)

    if safety_score >= 70:
        label = "Low"
    elif safety_score >= 50:
        label = "Moderate"
    elif safety_score >= 30:
        label = "High"
    else:
        label = "Very High"

    return {
        "safety_score": safety_score,
        "label": label,
        "violent_count": est_violent,
        "total_count": est_total,
        "radius_miles": 0.5,
        "period_days": 365,
        "source": f"FBI {abbr} State Data (est.)",
    }
