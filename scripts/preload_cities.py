#!/usr/bin/env python3
"""Script to fetch and cache listings for popular cities."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.redfin import search_listings
from backend.db import SessionLocal
from backend.models.property import PropertyORM
from sqlalchemy import select

CITIES = [
    ("Miami", "FL", 50),
    ("Los Angeles", "CA", 50),
    ("San Jose", "CA", 50),
    ("Denver", "CO", 50),
    ("New York", "NY", 50),
    ("Phoenix", "AZ", 50),
    ("Chicago", "IL", 50),
    ("Atlanta", "GA", 50),
    ("Dallas", "TX", 50),
    ("Boston", "MA", 50),
]


async def fetch_city(city: str, state: str, limit: int):
    """Fetch listings for a city and save to DB."""
    print(f"Fetching {city}, {state}...")
    try:
        results = await search_listings(city, state, limit=limit)
        print(f"  Got {len(results)} results")
        
        if not results:
            return 0
            
        async with SessionLocal() as db:
            saved = 0
            for r in results:
                ext_id = r.get("external_id")
                if not ext_id:
                    continue
                    
                # Check if already exists
                stmt = select(PropertyORM).where(PropertyORM.external_id == ext_id)
                existing = await db.execute(stmt)
                if existing.scalar_one_or_none():
                    continue
                    
                prop = PropertyORM(
                    external_id=ext_id,
                    address_display=r.get("address_display"),
                    city=r.get("city"),
                    state=r.get("state"),
                    zip_code=r.get("zip_code"),
                    beds=r.get("beds"),
                    baths=r.get("baths"),
                    sqft=r.get("sqft"),
                    lot_sqft=r.get("lot_sqft"),
                    year_built=r.get("year_built"),
                    list_price=r.get("list_price"),
                    property_type=r.get("property_type"),
                    latitude=r.get("latitude"),
                    longitude=r.get("longitude"),
                    photo_url=r.get("photo_url"),
                )
                db.add(prop)
                saved += 1
                
            await db.commit()
            print(f"  Saved {saved} new listings for {city}, {state}")
            return saved
    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


async def main():
    total = 0
    for city, state, limit in CITIES:
        saved = await fetch_city(city, state, limit)
        total += saved
    print(f"\nTotal new listings saved: {total}")


if __name__ == "__main__":
    asyncio.run(main())
