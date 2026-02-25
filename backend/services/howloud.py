"""HowLoud noise API client."""
from typing import Any
import httpx
from backend.config import settings

BASE_URL = "https://howloud.com/api/score"


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


async def get_noise(lat: float, lng: float) -> dict:
    if not settings.HOWLOUD_API_KEY:
        return {}

    params = {
        "key": settings.HOWLOUD_API_KEY,
        "latitude": lat,
        "longitude": lng,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        result = data.get("result", [{}])
        score = float(result[0].get("score", 0)) if result else 0.0
        return {
            "noise_db": score,
            "noise_label": _noise_label(score),
        }
    except Exception:
        return {}
