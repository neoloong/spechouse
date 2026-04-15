"""HowLoud noise API client."""
from __future__ import annotations

import hashlib
from typing import Any

import httpx

from backend.config import settings

BASE_URL = "https://api.howloud.com/score"


def _noise_label(score: float) -> str:
    if score < 50:
        return "Very Quiet"
    elif score < 60:
        return "Quiet"
    elif score < 70:
        return "Moderate"
    elif score < 80:
        return "Loud"
    else:
        return "Very Loud"


def _mock_noise_score(lat: float, lng: float) -> dict:
    """Generate deterministic mock noise data from lat/lng coordinates."""
    coord_str = f"{lat:.6f},{lng:.6f}"
    hash_val = int(hashlib.md5(coord_str.encode()).hexdigest(), 16)

    # Map hash to score range [45, 85] with some distribution
    raw_score = (hash_val % 4001) / 100  # [0, 40]
    score = round(45.0 + raw_score, 1)   # [45, 85]

    # Sub-scores derived from same hash for consistency
    sub_hash = int(hashlib.md5((coord_str + "sub").encode()).hexdigest(), 16)
    traffic_score = round(30.0 + (sub_hash % 5001) / 100, 1)   # [30, 80]
    local_score = round(30.0 + ((sub_hash >> 8) % 5001) / 100, 1)
    airports_score = round(0.0 + ((sub_hash >> 16) % 3001) / 100, 1)  # [0, 30]

    scoretext_options = [
        "Quieter than most cities",
        "Moderate noise levels",
        "Busy urban environment",
        "Near highways or arterials",
        "Relatively quiet residential",
    ]
    scoretext = scoretext_options[sub_hash % len(scoretext_options)]

    return {
        "noise_db": score,
        "noise_label": _noise_label(score),
        "noise_detail": {
            "traffic": traffic_score,
            "local": local_score,
            "airports": airports_score,
            "scoretext": scoretext,
        },
    }


async def get_noise(lat: float, lng: float) -> dict:
    if not settings.HOWLOUD_API_KEY or settings.HOWLOUD_API_KEY.startswith("your_"):
        return _mock_noise_score(lat, lng)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                BASE_URL,
                headers={"x-api-key": settings.HOWLOUD_API_KEY},
                params={"lat": lat, "lng": lng},
            )
            resp.raise_for_status()
            data = resp.json()

        result = data.get("result", [{}])
        if not result:
            return {}
        score = float(result[0].get("score", 0))
        return {
            "noise_db": score,
            "noise_label": _noise_label(score),
            "noise_detail": {
                "traffic": result[0].get("traffic"),
                "local": result[0].get("local"),
                "airports": result[0].get("airports"),
                "scoretext": result[0].get("scoretext"),
            },
        }
    except Exception:
        return {}
