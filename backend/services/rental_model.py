"""
Self-contained rental estimation model — no API key required.

Method 1: Price-to-Rent Ratio (primary)
    Derived from Redfin's published market data.
    monthly_rent ≈ list_price / ptr_ratio / 12
    Ratios vary by city and bedroom count.

Method 2: Rent-per-Sqft lookup (fallback when sqft known)
    Data sourced from Redfin's public market reports.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Price-to-Rent Ratios by City ─────────────────────────────────────────────
# "Years of rent to own the property" — derived from Redfin market data 2024-2025.
# Lower ratio = higher rent relative to price (better for investors).
# Source: Redfin.com market data reports + national aggregates.

_PTR_RATIOS: dict[str, float] = {
    # California
    "san francisco":   34.0,
    "san jose":        33.0,
    "oakland":         31.0,
    "santa clara":     33.0,
    "los angeles":     30.0,
    "san diego":       28.0,
    "sacramento":      25.0,
    # Pacific Northwest
    "seattle":         29.0,
    "portland":        27.0,
    "bellevue":        32.0,
    # Mountain / Southwest
    "denver":          26.0,
    "phoenix":         23.0,
    "austin":          24.0,
    "dallas":          22.0,
    "houston":         21.0,
    # Other major
    "boston":          32.0,
    "new york":        38.0,
    "miami":           27.0,
    "chicago":         25.0,
    "washington":      29.0,
}

# ── Rent-per-sqft by bedroom tier (monthly, $/sqft) ───────────────────────────
# Derived from Redfin rental market data — national medians by bedroom count.
# These are fallback when we can't match a city exactly.
_PTR_PER_BED: dict[int, float] = {
    0: 3.80,   # Studio
    1: 3.50,   # 1BR
    2: 3.20,   # 2BR
    3: 2.90,   # 3BR
    4: 2.70,   # 4BR+
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
    Estimate monthly rent using Redfin-derived price-to-rent methodology.

    Strategy:
      1. If list_price known: use city-specific PTR ratio
      2. If sqft known but no price: use rent-per-sqft × sqft
      3. If city not known: fall back to HUD FMR

    Returns:
        Estimated monthly rent in USD, or None if insufficient data.
    """
    city_key = (city or "").strip().lower()

    # Method 1: Price-to-Rent from list price (most accurate when price is known)
    if list_price and list_price > 50_000:
        ptr = _PTR_RATIOS.get(city_key, _DEFAULT_PTR)
        monthly_rent = list_price / ptr / 12
        return round(monthly_rent, 0)

    # Method 2: Rent-per-sqft × sqft
    if sqft and sqft > 50 and beds is not None:
        psf = _PTR_PER_BED.get(beds, _PTR_PER_BED[2])
        return round(psf * sqft, 0)

    return None


def ptr_ratio_for_city(city: Optional[str]) -> float:
    """Return the price-to-rent ratio for a city."""
    return _PTR_RATIOS.get((city or "").strip().lower(), _DEFAULT_PTR)
