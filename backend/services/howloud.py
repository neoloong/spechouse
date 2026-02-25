"""HowLoud noise API client."""
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


async def get_noise(lat: float, lng: float) -> dict:
    if not settings.HOWLOUD_API_KEY or settings.HOWLOUD_API_KEY.startswith("your_"):
        return {}

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
