"""
HUD Fair Market Rent estimator.
Provides free rental estimates with zero API calls.
Data source: HUD FY2024 published FMRs (embedded in backend/data/hud_fmr.py).
"""
from typing import Optional
from backend.data.hud_fmr import FMR, STATE_AVG


def get_rent_estimate(
    city: Optional[str],
    state: Optional[str],
    beds: Optional[int],
) -> Optional[float]:
    """
    Return monthly rent estimate in USD.
    Lookup order: exact city → state average → None.
    beds: 0=studio, 1=1BR, 2=2BR, 3=3BR, 4+=4BR
    """
    bed_idx = max(0, min(int(beds or 2), 4))
    city_key = (city or "").strip().lower()
    state_key = (state or "").strip().lower()

    # Try exact city match
    lookup_key = f"{city_key}|{state_key}"
    if lookup_key in FMR:
        return float(FMR[lookup_key][bed_idx])

    # Try city without common suffixes ("fort worth" → "fort worth")
    for key, rents in FMR.items():
        fmr_city, fmr_state = key.split("|")
        if fmr_state == state_key and (
            fmr_city.startswith(city_key) or city_key.startswith(fmr_city)
        ):
            return float(rents[bed_idx])

    # State average fallback
    if state_key in STATE_AVG:
        return float(STATE_AVG[state_key][bed_idx])

    return None


def get_all_fmr(city: Optional[str], state: Optional[str]) -> Optional[dict]:
    """Return all bedroom tiers for a location."""
    state_key = (state or "").strip().lower()
    city_key = (city or "").strip().lower()
    lookup_key = f"{city_key}|{state_key}"

    rents = FMR.get(lookup_key)
    if rents is None:
        for key, r in FMR.items():
            fc, fs = key.split("|")
            if fs == state_key and (fc.startswith(city_key) or city_key.startswith(fc)):
                rents = r
                break
    if rents is None:
        rents = STATE_AVG.get(state_key)
    if rents is None:
        return None

    return {
        "studio": rents[0],
        "1br": rents[1],
        "2br": rents[2],
        "3br": rents[3],
        "4br": rents[4],
        "source": "HUD FY2024 Fair Market Rents",
    }
