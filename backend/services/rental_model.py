"""
Self-contained rental estimation model — no API key required.

Data sourced from Zillow Research + Apartment List public reports (Q1 2025).
Updated manually when Zillow publishes new city-level data.

Coverage: 20 major US cities. For unknown cities → Price-to-Rent fallback.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Zillow / Apartment List city-level median rent data (Q1 2025) ─────────────
# Source: Zillow Rental Manager Market Trends, SF Chronicle, Apartment List.
# Format: median asking rent by bedroom (0=studio, 1=1BR, 2=2BR, 3=3BR, 4=4BR+).
# These are ground-truth anchors for each city.

_CITY_RENTS: dict[str, dict[int, float]] = {
    # California
    "san francisco":  {0: 2495, 1: 2864, 2: 3394, 3: 4100, 4: 5200},
    "san jose":       {0: 2300, 1: 2680, 2: 3200, 3: 3900, 4: 4800},
    "oakland":        {0: 1900, 1: 2300, 2: 2800, 3: 3400, 4: 4200},
    "santa clara":    {0: 2200, 1: 2600, 2: 3100, 3: 3800, 4: 4600},
    "los angeles":    {0: 2100, 1: 2500, 2: 3200, 3: 4000, 4: 5100},
    "san diego":      {0: 2000, 1: 2400, 2: 3000, 3: 3700, 4: 4600},
    "sacramento":     {0: 1300, 1: 1600, 2: 2000, 3: 2500, 4: 3200},
    "fresno":         {0: 1100, 1: 1300, 2: 1600, 3: 2000, 4: 2600},
    # Pacific Northwest
    "seattle":        {0: 1800, 1: 2100, 2: 2600, 3: 3200, 4: 4000},
    "portland":       {0: 1400, 1: 1700, 2: 2100, 3: 2600, 4: 3300},
    "bellevue":       {0: 1900, 1: 2300, 2: 2900, 3: 3600, 4: 4500},
    # Mountain / Southwest
    "denver":         {0: 1600, 1: 1900, 2: 2400, 3: 3000, 4: 3800},
    "phoenix":        {0: 1300, 1: 1500, 2: 1900, 3: 2400, 4: 3100},
    "austin":         {0: 1500, 1: 1800, 2: 2200, 3: 2800, 4: 3600},
    "dallas":         {0: 1300, 1: 1600, 2: 2000, 3: 2500, 4: 3200},
    "houston":        {0: 1200, 1: 1500, 2: 1900, 3: 2400, 4: 3100},
    # Other major
    "boston":         {0: 2200, 1: 2600, 2: 3200, 3: 3900, 4: 5000},
    "new york":       {0: 2800, 1: 3400, 2: 4000, 3: 5000, 4: 6500},
    "miami":          {0: 2100, 1: 2500, 2: 3100, 3: 3900, 4: 5000},
    "chicago":        {0: 1700, 1: 2000, 2: 2500, 3: 3100, 4: 4000},
    "washington":     {0: 2000, 1: 2400, 2: 3000, 3: 3700, 4: 4600},
    # Secondary markets
    "atlanta":        {0: 1500, 1: 1800, 2: 2200, 3: 2800, 4: 3500},
    "tampa":          {0: 1500, 1: 1800, 2: 2200, 3: 2800, 4: 3500},
    "orlando":        {0: 1500, 1: 1800, 2: 2200, 3: 2700, 4: 3400},
    "las vegas":      {0: 1300, 1: 1500, 2: 1900, 3: 2400, 4: 3100},
    "raleigh":        {0: 1400, 1: 1700, 2: 2100, 3: 2600, 4: 3300},
    "charlotte":      {0: 1400, 1: 1700, 2: 2100, 3: 2600, 4: 3300},
    "minneapolis":    {0: 1400, 1: 1700, 2: 2100, 3: 2600, 4: 3300},
    "philadelphia":   {0: 1500, 1: 1800, 2: 2200, 3: 2800, 4: 3600},
    "san antonio":    {0: 1100, 1: 1300, 2: 1600, 3: 2000, 4: 2600},
    "fort worth":     {0: 1200, 1: 1500, 2: 1900, 3: 2400, 4: 3100},
}

# ── Price-to-Rent Ratios by City (fallback for price-based estimation) ─────────
# Derived from Redfin published market data 2024-2025.
# Monthly rent ≈ list_price / ptr / 12

_PTR_RATIOS: dict[str, float] = {
    "san francisco": 34.0, "san jose": 33.0, "oakland": 31.0,
    "santa clara": 33.0, "los angeles": 30.0, "san diego": 28.0,
    "sacramento": 25.0, "fresno": 20.0,
    "seattle": 29.0, "portland": 27.0, "bellevue": 32.0,
    "denver": 26.0, "phoenix": 23.0, "austin": 24.0,
    "dallas": 22.0, "houston": 21.0,
    "boston": 32.0, "new york": 38.0, "miami": 27.0,
    "chicago": 25.0, "washington": 29.0,
    "atlanta": 23.0, "tampa": 24.0, "orlando": 22.0,
    "las vegas": 22.0, "raleigh": 24.0, "charlotte": 23.0,
    "minneapolis": 24.0, "philadelphia": 25.0,
    "san antonio": 19.0, "fort worth": 20.0,
}

_DEFAULT_PTR = 28.0


def estimate_rent(
    list_price: Optional[float] = None,
    sqft: Optional[int] = None,
    beds: Optional[int] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
) -> Optional[float]:
    """
    Estimate monthly rent using Zillow-derived city medians (Q1 2025).

    Strategy (tiered, most → least accurate):
      1. City median rent by bedroom from Zillow data (ground truth)
      2. Price-to-Rent ratio from list price (if city not in Zillow coverage)
      3. None — let caller fall back to HUD FMR

    Returns:
        Estimated monthly rent in USD, or None.
    """
    city_key = (city or "").strip().lower()

    # ── Tier 1: Zillow city median by bedroom ─────────────────────────────────
    if city_key in _CITY_RENTS and beds is not None:
        city_data = _CITY_RENTS[city_key]
        # Clamp beds: 0 (studio) stays 0, 5+ → 4 (4BR+ bucket)
        br_key = max(0, min(beds, 4))
        rent = city_data.get(br_key)
        if rent:
            return float(rent)

    # ── Tier 2: Price-to-Rent from list price ─────────────────────────────────
    if list_price and list_price > 50_000:
        ptr = _PTR_RATIOS.get(city_key, _DEFAULT_PTR)
        return round(list_price / ptr / 12, 0)

    return None


def ptr_ratio_for_city(city: Optional[str]) -> float:
    """Return the price-to-rent ratio for a city."""
    return _PTR_RATIOS.get((city or "").strip().lower(), _DEFAULT_PTR)
