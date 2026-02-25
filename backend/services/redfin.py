"""
Redfin unofficial API client.
- Nominatim (OSM) resolves city name → bounding box (no API key required)
- Redfin gis-csv endpoint returns active sale listings within that bbox
- og:image scrape on listing page returns a real CDN photo URL
All calls are cached at the DB level after the first fetch per city.
"""
import csv
import io
import re
import logging
from typing import Optional, List

import httpx

logger = logging.getLogger(__name__)

RF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.redfin.com/",
}
NOM_HEADERS = {"User-Agent": "SpecHouse/1.0 (real-estate-research-app)"}


def _normalize_geo_query(city: str, state: Optional[str]) -> str:
    """
    Build a clean Nominatim query like 'Fremont, CA, USA'.
    Handles inputs like 'Fremont CA', 'Fremont, CA', 'Fremont' + state='CA'.
    """
    import re as _re

    city = city.strip().rstrip(",")

    # If city already contains a comma, trust it's formatted (e.g. "Fremont, CA")
    if "," in city:
        parts = [p.strip() for p in city.split(",")]
    else:
        # Try to split "Fremont CA" → ["Fremont", "CA"] by last word
        words = city.split()
        # US state codes are 2 uppercase letters at the end
        if len(words) >= 2 and _re.match(r"^[A-Z]{2}$", words[-1]):
            parts = [" ".join(words[:-1]), words[-1]]
        elif state:
            parts = [city, state.upper()]
        else:
            parts = [city]

    # Ensure state is included if provided and not already there
    if state and len(parts) == 1:
        parts.append(state.upper())

    parts = [p for p in parts if p]  # remove empty
    query = ", ".join(parts)
    if "usa" not in query.lower():
        query += ", USA"
    return query


async def _get_city_bbox(query: str) -> Optional[tuple]:
    """
    Resolve a city name to a bounding box via Nominatim (free, no API key).
    Returns (lat_min, lat_max, lng_min, lng_max) or None.
    Filters out point-like results (businesses/addresses) by requiring min bbox size.
    """
    try:
        async with httpx.AsyncClient(timeout=15, headers=NOM_HEADERS) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 5},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"Nominatim failed for '{query}': {type(e).__name__}: {e!r}")
        return None

    if not data:
        logger.warning(f"Nominatim: no results for '{query}'")
        return None

    # Pick the first result whose bbox spans at least ~1km (0.01 degrees)
    for item in data:
        bbox = item.get("boundingbox")
        if not bbox or len(bbox) < 4:
            continue
        lat_min, lat_max, lng_min, lng_max = [float(x) for x in bbox]
        if (lat_max - lat_min) > 0.01 and (lng_max - lng_min) > 0.01:
            logger.info(f"Nominatim resolved '{query}' → {item['display_name']} bbox={bbox}")
            return (lat_min, lat_max, lng_min, lng_max)

    # Fallback: use first result regardless of size
    bbox = data[0].get("boundingbox")
    if bbox and len(bbox) == 4:
        logger.warning(f"Nominatim: using small bbox for '{query}': {bbox}")
        return tuple(float(x) for x in bbox)
    return None


def _bbox_to_poly(lat_min: float, lat_max: float, lng_min: float, lng_max: float) -> str:
    """Convert bbox to Redfin gis-csv 'poly' parameter format: 'lng lat,lng lat,...'"""
    return (
        f"{lng_min} {lat_min},"
        f"{lng_max} {lat_min},"
        f"{lng_max} {lat_max},"
        f"{lng_min} {lat_max},"
        f"{lng_min} {lat_min}"
    )


async def search_listings(
    city: str,
    state: Optional[str] = None,
    beds_min: Optional[int] = None,
    price_max: Optional[float] = None,
    limit: int = 20,
) -> List[dict]:
    """
    Search active for-sale listings for a city.
    city can be "Fremont, CA" or "Fremont" or "Fremont CA" — all work.
    Returns parsed property dicts (photo_url is None; fetched later in background).
    """
    geo_query = _normalize_geo_query(city, state)
    bbox = await _get_city_bbox(geo_query)
    if not bbox:
        logger.warning(f"Cannot resolve bbox for: {geo_query}")
        return []

    lat_min, lat_max, lng_min, lng_max = bbox
    poly = _bbox_to_poly(lat_min, lat_max, lng_min, lng_max)

    params = {
        "al": 1,
        "num_homes": min(limit, 40),
        "ord": "redfin-recommended-asc",
        "page_number": 1,
        "start": 0,
        "uipt": "1,2,3,4",
        "v": 8,
        "poly": poly,
    }
    if beds_min:
        params["min_num_beds"] = beds_min
    if price_max:
        params["max_price"] = int(price_max)

    try:
        async with httpx.AsyncClient(
            timeout=20, headers=RF_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(
                "https://www.redfin.com/stingray/api/gis-csv",
                params=params,
            )
            resp.raise_for_status()
            text = resp.text
    except Exception as e:
        logger.warning(f"Redfin gis-csv failed: {e}")
        return []

    results = _parse_csv(text)
    logger.info(f"Redfin returned {len(results)} listings for '{geo_query}'")
    return results


_PROP_TYPE_MAP = {
    "Single Family Residential": "Single Family",
    "Condo/Co-op": "Condo",
    "Townhouse": "Townhouse",
    "Multi-Family (2-4 Unit)": "Multi-Family",
    "Mobile/Manufactured Home": "Mobile",
    "Land": "Land",
}


def _parse_csv(text: str) -> List[dict]:
    """Parse Redfin gis-csv text into a list of property dicts."""
    if not text or len(text.strip().splitlines()) < 2:
        return []

    reader = csv.DictReader(io.StringIO(text))
    results = []

    for row in reader:
        try:
            address = (row.get("ADDRESS") or "").strip()
            city_val = (row.get("CITY") or "").strip()
            state_val = (row.get("STATE OR PROVINCE") or "").strip()
            zip_val = (row.get("ZIP OR POSTAL CODE") or "").strip()

            # Skip disclaimer rows and empty rows
            if not address or not city_val or "accordance with" in address.lower():
                continue

            address_display = f"{address}, {city_val}, {state_val} {zip_val}".strip()

            def _num(s: Optional[str]) -> Optional[str]:
                if not s:
                    return None
                return s.replace(",", "").replace("$", "").strip() or None

            price_str = _num(row.get("PRICE"))
            sqft_str = _num(row.get("SQUARE FEET"))
            lot_str = _num(row.get("LOT SIZE"))
            beds_str = (row.get("BEDS") or "").strip() or None
            baths_str = (row.get("BATHS") or "").strip() or None
            year_str = (row.get("YEAR BUILT") or "").strip() or None
            hoa_str = _num(row.get("HOA/MONTH"))
            lat_str = (row.get("LATITUDE") or "").strip() or None
            lng_str = (row.get("LONGITUDE") or "").strip() or None
            mls = (row.get("MLS#") or "").strip()
            prop_type_raw = (row.get("PROPERTY TYPE") or "").strip()

            # The URL column header is very long — find it by prefix
            url = ""
            for key in row.keys():
                if key.upper().startswith("URL"):
                    url = (row[key] or "").strip()
                    break

            price = float(price_str) if price_str else None
            sqft = int(float(sqft_str)) if sqft_str else None
            lot = int(float(lot_str)) if lot_str else None
            beds = int(float(beds_str)) if beds_str else None
            baths = float(baths_str) if baths_str else None
            year = int(float(year_str)) if year_str else None
            hoa = float(hoa_str) if hoa_str else None
            lat = float(lat_str) if lat_str else None
            lng = float(lng_str) if lng_str else None

            # Extract Redfin property ID from listing URL
            prop_id = None
            if url:
                m = re.search(r"/home/(\d+)", url)
                if m:
                    prop_id = m.group(1)

            external_id = f"redfin-{prop_id or mls or address}"
            prop_type = _PROP_TYPE_MAP.get(prop_type_raw, prop_type_raw or "Single Family")

            results.append({
                "external_id": external_id,
                "address_display": address_display,
                "city": city_val,
                "state": state_val,
                "zip_code": zip_val,
                "beds": beds,
                "baths": baths,
                "sqft": sqft,
                "lot_sqft": lot,
                "year_built": year,
                "hoa_fee": hoa,
                "property_tax": None,
                "list_price": price,
                "property_type": prop_type,
                "latitude": lat,
                "longitude": lng,
                "photo_url": None,   # fetched later in background task
                "photos": [],
                "source": "redfin",
                "_redfin_url": url,  # kept for background photo fetch
            })
        except Exception as e:
            logger.debug(f"CSV row parse error: {e}")
            continue

    return results


async def fetch_photo_url(redfin_url: str) -> Optional[str]:
    """
    Scrape og:image meta tag from a Redfin listing page.
    Returns the CDN photo URL (ssl.cdn-redfin.com) or None.
    """
    if not redfin_url:
        return None
    try:
        async with httpx.AsyncClient(
            timeout=15, headers=RF_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(redfin_url)
            if resp.status_code != 200:
                return None
            text = resp.text

        # og:image can appear as content before or after property= attribute
        m = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            text,
        )
        if not m:
            m = re.search(
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                text,
            )
        if m:
            url = m.group(1)
            if "cdn-redfin.com" in url or "redfin.com" in url:
                return url
    except Exception as e:
        logger.debug(f"Photo scrape failed for {redfin_url}: {e}")
    return None
