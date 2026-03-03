#!/bin/bash
# SpecHouse Daily Data Update Cron Job
# Run: crontab -e
# Add: 0 6 * * * /Users/chao/.openclaw/workspace/spechouse/scripts/daily_update.sh >> /Users/chao/.openclaw/workspace/spechouse/logs/cron.log 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Activate virtual environment and run update
cd "$PROJECT_DIR/backend"

# Check if Docker/PostgreSQL is running
if ! docker ps | grep -q spechouse-postgres; then
    echo "[$(date)] ERROR: PostgreSQL container not running" | tee -a "$LOG_DIR/cron.log"
    exit 1
fi

# Run the preload script
echo "[$(date)] Starting daily data update..." | tee -a "$LOG_DIR/cron.log"

python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from services.redfin import search_listings
from db import SessionLocal
from models.property import PropertyORM
from sqlalchemy import select

CITIES = [
    ('Miami', 'FL', 50),
    ('Los Angeles', 'CA', 50),
    ('San Jose', 'CA', 50),
    ('Denver', 'CO', 50),
    ('New York', 'NY', 50),
    ('Phoenix', 'AZ', 50),
    ('Chicago', 'IL', 50),
    ('Atlanta', 'GA', 50),
    ('Dallas', 'TX', 50),
    ('Boston', 'MA', 50),
]

async def fetch_city(city, state, limit):
    print(f'Fetching {city}, {state}...')
    try:
        results = await search_listings(city, state, limit=limit)
        print(f'  Got {len(results)} results')
        
        if not results:
            return 0
            
        async with SessionLocal() as db:
            saved = 0
            for r in results:
                ext_id = r.get('external_id')
                if not ext_id:
                    continue
                    
                stmt = select(PropertyORM).where(PropertyORM.external_id == ext_id)
                existing = await db.execute(stmt)
                if existing.scalar_one_or_none():
                    continue
                    
                prop = PropertyORM(
                    external_id=ext_id,
                    address_display=r.get('address_display'),
                    city=r.get('city'),
                    state=r.get('state'),
                    zip_code=r.get('zip_code'),
                    beds=r.get('beds'),
                    baths=r.get('baths'),
                    sqft=r.get('sqft'),
                    lot_sqft=r.get('lot_sqft'),
                    year_built=r.get('year_built'),
                    list_price=r.get('list_price'),
                    property_type=r.get('property_type'),
                    latitude=r.get('latitude'),
                    longitude=r.get('longitude'),
                    photo_url=r.get('photo_url'),
                )
                db.add(prop)
                saved += 1
                
            await db.commit()
            print(f'  Saved {saved} new listings for {city}, {state}')
            return saved
    except Exception as e:
        print(f'  Error: {e}')
        return 0

async def main():
    total = 0
    for city, state, limit in CITIES:
        saved = await fetch_city(city, state, limit)
        total += saved
    print(f'Total new listings saved: {total}')

asyncio.run(main())
" 2>&1 | tee -a "$LOG_DIR/cron.log"

echo "[$(date)] Daily update complete" | tee -a "$LOG_DIR/cron.log"
