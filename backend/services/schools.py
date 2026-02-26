"""Nearby schools via OpenStreetMap Overpass API (no API key required)."""
import math
import httpx
from typing import Optional

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


async def get_nearby_schools(lat: float, lng: float, radius_m: int = 5000) -> list:
    """Return up to 15 schools within radius_m metres, sorted by distance."""
    query = f"""
[out:json][timeout:20];
(
  node["amenity"="school"](around:{radius_m},{lat},{lng});
  node["amenity"="college"](around:{radius_m},{lat},{lng});
  node["amenity"="university"](around:{radius_m},{lat},{lng});
  way["amenity"="school"](around:{radius_m},{lat},{lng});
  way["amenity"="college"](around:{radius_m},{lat},{lng});
  way["amenity"="university"](around:{radius_m},{lat},{lng});
);
out center 20;
"""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    schools = []
    seen_names: set = set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        slat = el.get("lat") or (el.get("center") or {}).get("lat")
        slng = el.get("lon") or (el.get("center") or {}).get("lon")
        dist: Optional[float] = (
            round(_haversine_miles(lat, lng, float(slat), float(slng)), 2)
            if slat and slng
            else None
        )

        schools.append({
            "name": name,
            "type": tags.get("amenity", "school"),
            "level": tags.get("school:level") or tags.get("isced:level"),
            "distance_mi": dist,
        })

    schools.sort(key=lambda s: s.get("distance_mi") or 99)
    return schools[:15]
