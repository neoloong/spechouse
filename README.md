# SpecHouse

**The GSMarena for homes** — a real estate aggregation + comparison platform with enriched signals (noise, crime, rental yield, investment score) that Zillow and Redfin don't show side-by-side.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + Shadcn UI |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 + PostGIS |
| Map | Maplibre GL JS |
| Property data | Rentcast API |
| Noise data | HowLoud API |

---

## Quick Start

### 1. Clone & configure environment

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Edit `backend/.env` and add your API keys:
- `RENTCAST_API_KEY` — get one at https://app.rentcast.io/app/api-access
- `HOWLOUD_API_KEY` — get one at https://howloud.com/developers

### 2. Start PostgreSQL + PostGIS

```bash
docker compose up -d
```

Waits until healthy (`pg_isready`). The `backend/db/init.sql` schema is auto-applied.

### 3. Run the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn backend.main:app --reload
```

FastAPI docs: http://localhost:8000/docs

### 4. Run the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Next.js: http://localhost:3000

---

## Verification Checklist

- [ ] `docker compose up -d` → PostgreSQL healthy
- [ ] `uvicorn backend.main:app --reload` → `/docs` loads
- [ ] `GET /properties/search?city=Austin&beds=3` → returns enriched properties
- [ ] `GET /compare?ids=1,2` → returns side-by-side spec matrix
- [ ] `npm run dev` → homepage at localhost:3000
- [ ] Search "Austin TX" → results grid + map pins
- [ ] Click property → detail page with scores
- [ ] Add 2 properties → compare table with green/red diffs

---

## Project Structure

```
real_estate/
├── frontend/                      # Next.js 15
│   ├── app/
│   │   ├── page.tsx               # Homepage search
│   │   ├── listings/page.tsx      # Results grid + map
│   │   ├── property/[id]/page.tsx # Property detail
│   │   └── compare/page.tsx       # Spec comparison table
│   ├── components/
│   │   ├── SearchBar.tsx
│   │   ├── PropertyCard.tsx
│   │   ├── MapView.tsx
│   │   ├── CompareTable.tsx       # Core: full spec table w/ diff highlight
│   │   └── ScoreBadge.tsx
│   └── lib/api.ts                 # Typed fetch helpers
├── backend/                       # FastAPI
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── routers/
│   │   ├── properties.py          # GET /properties/search, GET /properties/{id}
│   │   ├── compare.py             # GET /compare?ids=1,2,3
│   │   └── enrich.py             # POST /enrich/{id}
│   ├── services/
│   │   ├── rentcast.py
│   │   ├── howloud.py
│   │   └── scorer.py
│   ├── models/property.py
│   └── db/init.sql
├── docker-compose.yml
└── .env.example
```

---

## Property Score Algorithm

Weighted composite 0–100:

| Signal | Weight |
|---|---|
| Rental yield vs market | 25% |
| Noise level (inverted) | 20% |
| Crime score (inverted) | 20% |
| Price vs Rentcast AVM | 20% |
| Price trend (90-day) | 15% |

Sub-scores:
- **Value Score** = price vs AVM + rental yield average
- **Investment Score** = rental yield + price trend average

---

## API Reference

| Endpoint | Description |
|---|---|
| `GET /properties/search?city=Austin&beds=3&max_price=500000` | Search + cache properties |
| `GET /properties/{id}` | Full property detail |
| `GET /compare?ids=1,2,3` | Side-by-side spec matrix |
| `POST /enrich/{id}` | Manually trigger noise + score enrichment |
| `GET /health` | Health check |
