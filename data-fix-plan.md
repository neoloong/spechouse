# SpecHouse Data Fix Plan
**Author:** Senior Full-Stack Engineer (Data Integration Review)
**Date:** 2026-04-15
**Status:** For Implementation

---

## 1. Problem Summary

The search API route (`frontend/app/api/search/route.ts`) has two critical issues:

1. **Production bug (T-B01):** It always uses `MOCK_PROPERTIES`, completely ignoring the FastAPI backend already configured in `NEXT_PUBLIC_API_URL`. When users search any city, they get 0 results on the live site.

2. **Insufficient mock data:** Only 3 SF, 2 Austin, 2 Seattle, 2 NYC listings exist in `MOCK_PROPERTIES`. Searching for other cities always returns 0 results.

**Root cause:** The search route was written as a pure mock prototype. The FastAPI backend (`lib/api.ts`) exists and has a proper `searchProperties()` client — but the search route never calls it.

---

## 2. Current Architecture

```
Frontend Search Request
  → GET /api/search?q=San Francisco
  → route.ts: normalizeQuery("San Francisco") → {city: "San Francisco", state: "CA"}
  → Filters MOCK_PROPERTIES["San Francisco"] (3 listings)
  → Returns 3 results OR 0 if city not in MOCK_PROPERTIES
  ❌ Never calls FastAPI backend at NEXT_PUBLIC_API_URL
```

The FastAPI backend is already running (at `http://192.168.1.88:8000` locally or `https://matchable-hildegard-untransformed.ngrok-free.dev`), and `lib/api.ts` already has:
- `searchProperties(params: SearchParams)` → `GET /properties/search`
- Typed response with `PropertyListItem[]`
- Rich mock data for `getPropertyDetail()`

**But the search route never uses any of this.**

---

## 3. Solution: Minimum Viable Data Integration

### 3.1 Architecture Decision

**Option A — Proxy through FastAPI (recommended):**
```
Search request → Next.js /api/search → FastAPI /properties/search → Real DB
                                              ↓ (on failure)
                                          MOCK_PROPERTIES fallback
```

**Option B — Direct client-side call to FastAPI:**
```
Search request → lib/api.ts → FastAPI directly
```
Risk: exposes backend URL to client, harder to add auth/gateway later.

**Chosen: Option A** — Add a new server-side search route that proxies to FastAPI with mock fallback.

### 3.2 API to Use

**FastAPI backend** at `NEXT_PUBLIC_API_URL`:
- Already deployed and running
- Already has `GET /properties/search` with city/state/beds/baths/sqft filters
- No credit card required
- Already in `lib/api.ts` as `searchProperties()`

### 3.3 Env Variables Needed

```bash
# Already set in .env.local:
NEXT_PUBLIC_API_URL=http://192.168.1.88:8000

# .env.production (already set with ngrok URL — good for demo):
NEXT_PUBLIC_API_URL=https://matchable-hildegard-untransformed.ngrok-free.dev
```

No new env vars required. The backend URL is already configured.

---

## 4. File Changes

### 4.1 Modify: `frontend/app/api/search/route.ts`

**Current state:** Returns mock data only, ignores FastAPI backend.

**Change:** Add a `try/fetch → mock fallback` pattern that calls the FastAPI backend first.

```typescript
// At top of file, after imports:
import { searchProperties } from "@/lib/api";

// New helper — converts API response to SearchProperty format
function adaptProperty(p: PropertyListItem): SearchProperty {
  return {
    id: p.id,
    address: p.address_display,
    city: p.city ?? "",
    state: p.state ?? "",
    price: p.list_price ?? 0,
    beds: p.beds ?? 0,
    baths: p.baths ?? 0,
    sqft: p.sqft ?? 0,
    photoUrl: p.photo_url ?? "",
    overallScore: p.agg_data?.scores?.overall ?? 5.0,
    lastUpdated: p.last_enriched ?? new Date().toISOString(),
  };
}

// In GET handler, replace the MOCK_PROPERTIES lookup with:
let properties: SearchProperty[] = [];

try {
  const cityNormalized = normalizeQuery(q);
  const results = await searchProperties({
    city: cityNormalized.city,
    state: cityNormalized.state || undefined,
    limit: 50,
  });
  properties = results.map(adaptProperty);
} catch {
  // FastAPI unavailable — fall back to mock data
  const { city, state } = normalizeQuery(q);
  let fallback = MOCK_PROPERTIES[city] ?? [];
  if (state) fallback = fallback.filter((p) => p.state === state);
  properties = fallback;
}
```

### 4.2 New File: `frontend/lib/mockData.ts`

Expand the existing `MOCK_PROPERTIES` to cover more cities. This is the **quick win** while FastAPI integration is being tested.

**Add cities:** Los Angeles, Chicago, Miami, Denver, Boston, Phoenix, Portland, San Diego, Dallas, Atlanta
**Add listings per city:** 8-15 listings each
**Total target:** 100+ listings across 12 cities

This file replaces the inline `MOCK_PROPERTIES` in `route.ts`.

### 4.3 New File: `frontend/app/api/search/types.ts`

Shared types for the search API (can be imported by other modules).

---

## 5. Commit-by-Commit Implementation

### Commit 1 — `feat: expand mock data for development fallback`
**Files:** `frontend/app/api/search/route.ts` (extract MOCK_PROPERTIES)
**New files:** `frontend/lib/mockData.ts`
**Time:** ~45 min

Extract `MOCK_PROPERTIES` to a new `lib/mockData.ts` file. Expand to 100+ listings across 12 cities.

```typescript
// lib/mockData.ts — export MOCK_PROPERTIES with 12 cities × 8-15 listings each
export const MOCK_PROPERTIES: Record<string, SearchProperty[]> = { ... }
```

Cities to add (minimum 8 listings each):
- San Francisco: expand to 20 listings
- Austin: expand to 12 listings
- Seattle: expand to 10 listings
- New York: expand to 12 listings
- Los Angeles: 10 listings
- Chicago: 8 listings
- Miami: 8 listings
- Denver: 8 listings
- Boston: 8 listings
- Phoenix: 8 listings
- Portland: 8 listings
- San Diego: 8 listings

### Commit 2 — `feat: proxy search API to FastAPI backend with mock fallback`
**Files:** `frontend/app/api/search/route.ts`
**Time:** ~60 min

Replace the mock-only lookup with:
1. Try `searchProperties()` from `lib/api.ts` (calls FastAPI)
2. On failure → fall back to `MOCK_PROPERTIES` (imported from `lib/mockData.ts`)

Also wire in filter params (beds, baths, price range) if provided.

### Commit 3 — `fix: enable mock fallback when backend returns empty`
**Files:** `frontend/app/api/search/route.ts`
**Time:** ~15 min

Add edge case: if FastAPI returns 0 results, try mock data for that city before giving up.

### Commit 4 — `test: add search integration tests`
**Files:** `frontend/app/api/search/route.test.ts` (new)
**Time:** ~30 min

Test that:
- Search for known city returns results
- Search for unknown city returns empty (not error)
- Filter params (beds, baths) are passed through
- Mock fallback fires when FastAPI is unavailable

---

## 6. Mock Data Expansion — Quick Win Details

### Fastest Path to 20+ SF Listings (No API Change)

In `route.ts`, just expand the `"San Francisco"` array in `MOCK_PROPERTIES`:

```typescript
// Add 17 more SF listings to the existing 3
// Use varied addresses, prices ($800K-$3M), beds (1-4), baths (1-3), sqft (600-2500)
// Use real SF neighborhood addresses:
// - Mission District, Castro, Noe Valley, Hayes Valley, Pacific Heights,
//   Marina, SOMA, Nob Hill, Russian Hill, Potrero Hill, Bernal Heights,
//   Glen Park, Inner Richmond, Outer Sunset, Haight-Ashbury, Presidio Heights
// Use Unsplash SF architecture photos (different IDs)
```

**Time to implement:** ~30 minutes to add 17 listings with real-looking addresses.

### Mock Data Structure (Full Expansion)

Each listing should have:
- `id`: unique integer
- `address`: realistic SF address (e.g., "2847 Sacramento St, San Francisco, CA 94115")
- `city`: "San Francisco"
- `state`: "CA"
- `price`: varied ($750K–$4M for SF)
- `beds`: 1–4
- `baths`: 1–3
- `sqft`: 600–2500
- `photoUrl`: Unsplash SF home photo
- `overallScore`: 5.0–9.5 (realistically distributed)
- `lastUpdated`: varied dates within past 30 days

---

## 7. Environment Variables

```bash
# Already configured — no changes needed:
NEXT_PUBLIC_API_URL=http://192.168.1.88:8000    # .env.local (local dev)
NEXT_PUBLIC_API_URL=https://matchable-...ngrok-free.dev  # .env.production

# Optional future addition (not needed now):
# PROPERTY_DATA_API_KEY=   # future paid tier for Redfin/Zillow API
```

---

## 8. Swappable Architecture

The design uses an **adapter pattern** so the data source can be swapped later:

```
GET /api/search?q=...
       ↓
┌─────────────────────────────────┐
│  SearchRoute (route.ts)        │
│  - Calls DataService.search()   │
│  - Adapts response to UI format │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│  DataService (lib/data.ts)     │  ← swap this file to change data source
│  - Primary: FastAPI backend     │
│  - Fallback: mockData.ts        │
└─────────────────────────────────┘
```

Future data sources (swappable without touching route.ts):
1. **Redfin API** → swap `DataService` implementation
2. **Zillow API** → swap `DataService` implementation
3. **Supabase/Postgres** → swap `DataService` implementation

---

## 9. Time Estimates

| Task | Time | Priority |
|------|------|----------|
| Expand mock data to 100+ listings | 45 min | P0 (immediate) |
| Add FastAPI proxy with fallback | 60 min | P0 (production fix) |
| Edge case: empty FastAPI result → mock | 15 min | P1 |
| Integration tests | 30 min | P1 |
| **Total** | **~2.5 hours** | |

---

## 10. Testing Checklist

- [ ] Search "San Francisco" → returns 20+ results (mock expansion)
- [ ] Search "SF" → returns SF results (alias still works)
- [ ] Search "Los Angeles" → returns 10 results (new mock city)
- [ ] Search "FakeCity" → returns 0 results with empty state UI
- [ ] FastAPI down → search still returns mock data (fallback works)
- [ ] Search page loads in < 3 seconds with mock data
- [ ] Property card shows address, price, beds, baths, sqft, photo, score

---

## 11. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| FastAPI backend is slow | Show skeleton loader; mock fallback after 5s timeout |
| FastAPI returns malformed data | `try/catch` around fetch; fall back to mock |
| Too many mock listings bloats bundle | `lib/mockData.ts` is loaded server-side only, not in client bundle |
| ngrok URL expires | Use local IP or deploy FastAPI to a stable host for production |
