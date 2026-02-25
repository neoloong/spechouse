"""Rentcast API client — property search and detail lookup."""
from typing import Any, Optional
import httpx
from backend.config import settings

BASE_URL = "https://api.rentcast.io/v1"


def _headers() -> dict:
    return {
        "X-Api-Key": settings.RENTCAST_API_KEY,
        "Accept": "application/json",
    }


async def search_properties(
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    beds_min: Optional[int] = None,
    beds_max: Optional[int] = None,
    price_max: Optional[float] = None,
    property_type: Optional[str] = None,
    limit: int = 40,
) -> list:
    params: dict = {"limit": limit, "status": "Active"}
    if city:
        params["city"] = city
    if state:
        params["state"] = state
    if zip_code:
        params["zipCode"] = zip_code
    if beds_min is not None:
        params["bedrooms"] = beds_min
    if price_max is not None:
        params["maxPrice"] = int(price_max)
    if property_type:
        params["propertyType"] = property_type

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BASE_URL}/listings/sale",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data
        return data.get("data", [])


async def get_property_detail(external_id: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BASE_URL}/listings/sale/{external_id}",
            headers=_headers(),
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


async def get_rental_estimate(
    address: Optional[str] = None,
    zip_code: Optional[str] = None,
    beds: Optional[int] = None,
    baths: Optional[float] = None,
    sqft: Optional[int] = None,
    property_type: Optional[str] = None,
) -> dict:
    params: dict = {}
    if address:
        params["address"] = address
    if zip_code:
        params["zipCode"] = zip_code
    if beds is not None:
        params["bedrooms"] = beds
    if baths is not None:
        params["bathrooms"] = baths
    if sqft is not None:
        params["squareFootage"] = sqft
    if property_type:
        params["propertyType"] = property_type

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BASE_URL}/avm/rent/long-term",
            headers=_headers(),
            params=params,
        )
        if resp.status_code in (400, 404, 422):
            return {}
        resp.raise_for_status()
        return resp.json()


def parse_listing(raw: dict) -> dict:
    return {
        "external_id": raw.get("id") or raw.get("formattedAddress", ""),
        "address_display": raw.get("formattedAddress", ""),
        "city": raw.get("city", ""),
        "state": raw.get("state", ""),
        "zip_code": raw.get("zipCode", ""),
        "beds": raw.get("bedrooms"),
        "baths": raw.get("bathrooms"),
        "sqft": raw.get("squareFootage"),
        "lot_sqft": raw.get("lotSize"),
        "year_built": raw.get("yearBuilt"),
        "hoa_fee": raw.get("hoaFee"),
        "property_tax": raw.get("annualTaxAmount"),
        "list_price": raw.get("price") or raw.get("listPrice"),
        "property_type": raw.get("propertyType"),
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
    }
