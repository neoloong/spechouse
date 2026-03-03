"""Schools data: assigned schools from Redfin, fallback to OpenStreetMap."""
import math
import re
import httpx
from typing import Optional
from bs4 import BeautifulSoup

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


REDFIN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


def _grade_range_to_level(grade_range: str) -> str:
    """Convert grade range like 'K-5', '6-8', '9-12' to level name."""
    gr = grade_range.upper().strip()
    # High school
    if re.search(r'\b(9|10|11|12)\b', gr):
        return "high"
    # Middle school
    if re.search(r'\b(6|7|8)\b', gr):
        return "middle"
    # Elementary
    return "elementary"


def _level_name(level: str) -> str:
    return {"elementary": "Elementary", "middle": "Middle School", "high": "High School"}.get(level, "School")


async def fetch_redfin_schools(redfin_url: str) -> list:
    """Scrape assigned schools from a Redfin property page."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(redfin_url, headers=REDFIN_HEADERS)
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return []

    schools = []
    seen_levels: set = set()

    # Parse SchoolsListItem blocks via regex on raw HTML
    # Structure: heading div (name) → description p (grades • Assigned • dist) → tags span (rating)
    block_pattern = re.compile(
        r'SchoolsListItem__heading[^>]*>([^<]+)</div>'   # school name
        r'.*?SchoolsListItem__description[^>]*>([^<]+)</p>'  # description
        r'(.*?)</span>',                                  # tags block
        re.DOTALL
    )

    rating_pattern = re.compile(r'Tag__text">(\d+)/10 rating')
    desc_pattern = re.compile(
        r'(?:Public|Private)[,\s]+([K\d][0-9\-]+)'  # grade range e.g. K-5 or 9-12
        r'[^•\u2022]*[•\u2022]\s*Assigned'
        r'[^•\u2022]*[•\u2022]\s*([0-9.]+)mi',
        re.IGNORECASE
    )

    for m in block_pattern.finditer(html):
        name = m.group(1).strip()
        desc = m.group(2).strip()
        tags_block = m.group(3)

        # Must be Assigned
        if "Assigned" not in desc:
            continue

        dm = desc_pattern.search(desc)
        if not dm:
            continue

        grade_range = dm.group(1).strip()
        distance = float(dm.group(2))
        level = _grade_range_to_level(grade_range)

        if level in seen_levels:
            continue
        seen_levels.add(level)

        rm = rating_pattern.search(tags_block)
        rating = int(rm.group(1)) if rm else None

        schools.append({
            "name": name,
            "type": level,
            "level": _level_name(level),
            "rating": rating,
            "grade_range": grade_range,
            "distance_mi": distance,
            "assigned": True,
        })

    order = {"elementary": 0, "middle": 1, "high": 2}
    schools.sort(key=lambda s: order.get(s["type"], 3))
    return schools


async def fetch_redfin_lifestyle(redfin_url: str) -> dict:
    """Scrape lifestyle scores (noise, walk, transit, etc.) from Redfin page."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(redfin_url, headers=REDFIN_HEADERS)
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return {}

    blocks = re.findall(
        r'LifestyleScoreCard--scoreValue">([\d.]+).*?'
        r'LifestyleScoreCard--descriptor">(.*?)</p>.*?'
        r'LifestyleScoreCard--description">(.*?)<',
        html, re.DOTALL
    )

    result = {}
    for score_str, label_raw, desc_raw in blocks:
        score = float(score_str)
        label = re.sub(r'<[^>]+>', '', label_raw).strip()
        desc = re.sub(r'<[^>]+>', '', desc_raw).strip()
        key = label.lower().replace(" ", "_")
        result[key] = {"score": score, "label": label, "description": desc}

    return result
