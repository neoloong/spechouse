# SpecHouse Code Review — April 15, 2026

**Reviewer:** SDET sub-agent (Cleo orchestrator)  
**Scope:** Full codebase — frontend (Next.js) + backend (FastAPI) + data pipeline  
**Environment:** Backend running on port 8000, PostgreSQL via Docker, ngrok tunnel active

---

## 1. Overall Architecture Assessment

**Verdict: Promising foundation with critical production gaps.**

The stack is well-structured: Next.js frontend → FastAPI backend → PostgreSQL + Redis-style in-memory cache → external scrapers/APIs. Data flows from Redfin (gis-csv → parse → DB upsert → background enrichment) through to the frontend. The DB has 1,061 persisted properties across 21 cities and is fully enriched. The main search pipeline is functional.

**What works:** Redfin scraper, DB persistence, rental estimation model, enrichment background tasks, city preloading, school scraping from Redfin listing pages, crime data from city open portals.

**What's broken or missing:** HowLoud API (null noise data), lifestyle score parsing (no noise data reaching compare), score scale mismatch (0-100 backend vs 0-10 frontend), no photo fetching in production (photo_url is always null), ngrok instability, API key gaps.

---

## 2. Issues Found

### 🔴 CRITICAL

#### C1: HowLoud API returns null — noise data completely missing
**Why:** `HOWLOUD_API_KEY` is empty (`"your_howloud_api_key_here"` placeholder value in `.env`). The `get_noise()` function in `howloud.py` explicitly returns `{}` when the key is absent or starts with `"your_"`:

```python
if not settings.HOWLOUD_API_KEY or settings.HOWLOUD_API_KEY.startswith("your_"):
    return {}
```

**Effect:** Every property in the DB has `noise: null` in `agg_data`. The `noise_db` and `noise_label` environment fields are absent for all 1,061 properties. The `_noise_score()` function in `scorer.py` is never invoked since `noise_data` is always empty.

**Confirmed:** DB query shows `noise` column is `NULL` for all SF properties. `get_noise(37.77, -122.42)` returns `{}`.

**Fix:** Set a valid HowLoud API key in `backend/.env`. HowLoud offers a free tier at [api.howloud.com](https://api.howloud.com). Without a key, the entire noise dimension of the scoring algorithm is dead weight.

---

#### C2: Lifestyle noise score never populated — compare page has no noise data
**Why:** The `_build_spec_row()` in `compare.py` looks for noise data in `agg_data['lifestyle']` (from Redfin listing page scrape), not in `agg_data['environment']['noise_db']` (from HowLoud API). The keys it searches are:
```python
noise_keys = ["silent_zone", "quiet_area", "low_noise", "noisy_area"]
```
But the howloud data is stored under `environment.noise_db`. These never connect.

**Effect:** The compare page shows no noise information for any property regardless of the HowLoud API being fixed or not. The `noise_score` and `noise_label` fields in `PropertySpec` are always `None`.

**Fix:** Either (a) map `agg_data['environment']['noise_db']` correctly in `_build_spec_row`, or (b) fix the howloud service to store noise data where `compare.py` expects it (in `lifestyle`), or (c) have `enrich_agg_data` copy noise data into the lifestyle block.

---

#### C3: Score scale mismatch — 0–100 backend vs 0–10 frontend
**Where:** `scorer.py` returns `overall`, `value`, `investment` on a **0–100 scale** (e.g., 28.3 for a $3.95M SF property). The frontend `ScoreBadge` component displays these scores and uses thresholds like `score >= 7` for "good".

**Effect:** A property with an overall score of 28 (out of 100) displays as 28/10 in the UI and gets a "bad" color (red) because 28 < 70 (the red/green threshold). This is structurally broken.

**Fix:** Either (a) change `scorer.py` to return 0–10 scale (divide all scores by 10), or (b) update the frontend `scoreColor()` to use 0–100 thresholds. Option (a) is cleaner — the overall score is stored once and all consumers benefit.

---

### 🟠 HIGH

#### H1: Redfin scraper fragility — no fallback when gis-csv is blocked
**Where:** `redfin.py` calls `https://www.redfin.com/stingray/api/gis-csv` and has a JSON fallback to `/stingray/api/gis`. The JSON endpoint requires parsing a JS-wrapped response: `text = re.sub(r'^\{\}&&', '', resp.text)`.

**Risk:** Redfin can (and does) block the CSV endpoint for some MLS markets (noted in comments: "NWMLS / Washington State"). The JSON path is more robust but (a) the regex `^\{\}&&` is brittle — if Redfin changes the wrapper, the JSON path silently returns empty results; (b) `__import__('json').loads(text)` is awkward and could fail on malformed data.

**Additional risk:** The scraper has no rate limiting. If a user searches many cities in succession, Redfin may detect unusual traffic patterns and block the IP. The 5-minute in-memory cache helps but doesn't protect against burst traffic.

**Recommendation:** Add exponential backoff on HTTP errors, log when JSON fallback is used, and consider using the Redfin official API (if available) instead of scraping.

---

#### H2: No photo URLs in production — all properties have `photo_url: None`
**Confirmed:** DB shows `photo_url` is `NULL` for all properties. The `fetch_photo_url()` function in `redfin.py` is called in `_enrich_property` only when `not photo_url`. But looking at the enrichment flow:

```python
photo_url = prop.photo_url
photos = prop.photos or []
if not photo_url:
    redfin_url = (prop.agg_data or {}).get("_redfin_url")
    if redfin_url:
        fetched = await redfin.fetch_photo_url(redfin_url)
```

The `_redfin_url` is stored in `agg_data` by `_upsert_property`, so photo fetch should work. But the search endpoint returns `PropertyListItem` which includes `photo_url` field — and it's null in the DB because background enrichment may not have completed the photo scrape for already-enriched properties.

**Fix:** Run a targeted re-enrichment just for photos:
```python
# Add to backend: admin endpoint to re-fetch photos only
```

Or trigger photo fetch during `_upsert_property` for new listings rather than waiting for background enrichment.

---

#### H3: ngrok tunnel is not production-ready
**Current setup:** `ngrok http 8000 --domain=matchable-hildegard-untransformed.ngrok-free.dev --log=stdout` running as a user-level process (PID 25222).

**Problems:**
- **No restart automation:** If ngrok crashes or is restarted, the tunnel URL changes. The `.env.production` has the current URL hardcoded, but Vercel frontend won't update automatically.
- **No process supervision:** If the process dies, the backend becomes unreachable from Vercel with no automatic restart.
- **Free tier limits:** ngrok free tier has connection limits and can drop sessions. Production needs either ngrok paid plan or a proper reverse proxy (Cloudflare Tunnel, etc.).
- **Bandwidth cap:** ngrok free tier limits data throughput.

**Fix options:**
1. Use a process manager (launchd, systemd) to auto-restart ngrok and report URL changes
2. Use Cloudflare Tunnel (free, stable) instead of ngrok
3. Deploy backend on a proper hosted platform (Railway, Render, Fly.io) with a fixed public URL
4. Use a dynamic DNS solution that updates `.env` when the URL changes

---

#### H4: `.env` API keys all empty — no external services work in production
**Current state of `backend/.env`:**
```
DATABASE_URL=postgresql://spechouse:spechouse@localhost:5432/spechouse  ✅
RENTCAST_API_KEY=                                          ❌ empty
HOWLOUD_API_KEY=                                           ❌ empty (placeholder)
HOWLOUD_CLIENT_ID=                                         ❌ empty
SPOTCRIME_API_KEY=                                         ❌ empty
ANTHROPIC_API_KEY=                                         ❌ empty (but not used anyway)
INTERNAL_API_KEY=fdd6b90a...                                ✅ set
```

**Impact:**
- **HowLoud:** Returns null (confirmed) — noise data missing across all properties
- **RentCast:** Completely unused — rental estimates rely solely on the hardcoded `rental_model.py` data (20 cities only, Q1 2025 stale)
- **SpotCrime:** Crime data relies entirely on city open data portals (SF, Austin) or FBI state averages. No real-time per-property crime data for other cities.
- **Anthropic:** Not used anywhere in the codebase (no AI features currently)

**Fix:** For production, at minimum: set `HOWLOUD_API_KEY` (free tier available). `RENTCAST_API_KEY` would improve rental estimates for cities outside the 30-city hardcoded list.

---

#### H5: `NEXT_PUBLIC_API_URL` mismatch between dev and production env
**Local (`.env.local`):** `NEXT_PUBLIC_API_URL=http://192.168.1.88:8000`  
**Production (`.env.production`):** `NEXT_PUBLIC_API_URL=https://matchable-hildegard-untransformed.ngrok-free.app`

**Problem:** Vercel deployment uses `.env.production` which points to the ngrok URL. If ngrok restarts and gets a new URL, the frontend will point to a dead URL with no way to update automatically.

**Fix:** Use a stable backend URL (see H3 fix above).

---

### 🟡 MEDIUM

#### M1: Enrichment race condition — photos fetch only if `last_enriched` was never set
**Where:** `search_properties()` only enqueues background enrichment if:
```python
needs_enrich = (
    prop.last_enriched is None
    or "schools" not in (prop.agg_data or {})
)
```
Once `last_enriched` is set, `needs_enrich` is `False` even if `photo_url` was never fetched. Properties enriched before photo-fetch was added will never get photos.

**Fix:** Add `photo_url is None` to the `needs_enrich` condition, or run a one-time re-enrichment for all properties missing photos.

---

#### M2: Crime service fails silently for unsupported cities — no differentiation from success
**Where:** `crime.py` — if city not in `CITY_DATASETS`, it returns FBI state-level estimates. This is indistinguishable from a city-level result in the UI (both show `"source": "City Open Data"` or `"FBI XX State Data (est.)"`).

**Effect:** A user in Phoenix sees a crime score that is a state-level estimate based on FBI 2022 data, not real Phoenix crime data. They can't tell it's an estimate vs. real city data.

**Fix:** Add a flag in the response indicating data quality: `"data_quality": "city" | "state_estimate" | "unavailable"`.

---

#### M3: CORS allows all origins on `allow_origins`
**Where:** `main.py`:
```python
allow_origins=[
    "http://localhost:3000",
    "https://spechouse.vercel.app",
    "https://*.vercel.app",  # too broad — any vercelapp.com subdomain passes
]
```

**Risk:** Any website claiming to be on a `vercel.app` subdomain can make authenticated requests to the backend API.

**Fix:** Use an explicit list of known frontend domains, or use environment variables to configure allowed origins.

---

#### M4: No pagination in the search endpoint — limit param is misleading
**Where:** `search_properties` route in `properties.py` accepts `limit` (max 350) and passes to Redfin, but then the frontend does its own pagination with `pageSize = 10` — slicing the full result set in memory. This means if Redfin returns 350 listings, the frontend still shows 10 at a time but the full 350 is fetched every time a user paginates (because there's no server-side cursor/page tracking).

**Fix:** Implement true database-level pagination with `OFFSET` / `LIMIT` in the SQL query, or at minimum cache the full result in Redis with a session-scoped cursor.

---

#### M5: No authentication on POST `/leads` endpoint
**Where:** `frontend/app/api/leads/route.ts` — accepts name, phone, email, propertyIds from any request. While there is basic validation, there's no rate limiting, no CAPTCHA, and no authentication.

**Risk:** This endpoint could be spammed. In production, add rate limiting (e.g., 5 leads per IP per hour) and consider CAPTCHA for anonymous submissions.

---

### 🟢 LOW

#### L1: `school_level` field in `PropertySpec` is not populated
**Where:** `compare.py` `_build_spec_row()` returns `school_elementary`, `school_middle`, `school_high` but `PropertySpec` interface in `api.ts` also has a `schools?: SchoolEntry[]` field which is never populated from the backend.

**Impact:** The detailed school data from Redfin (ratings, distances, grade ranges) is available in `agg_data['schools']` but not forwarded to the frontend in a structured way. The compare page uses the string-formatted school names instead of structured data.

---

#### L2: DB migration on every startup — `create_all` is no-op in PostgreSQL but wasteful
**Where:** `main.py` lifespan:
```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
```
For PostgreSQL this is harmless (creates tables if not exist, no-op if they do), but it still opens a connection and checks on every startup. For production, use Alembic for migrations.

---

#### L3: `preload_cities` endpoint is fire-and-forget with no status tracking
**Where:** `properties.py` `/admin/preload-cities` spawns background tasks for 8 cities but returns immediately. There's no job queue, no status endpoint, no retry logic. If a city fails, it silently fails.

**Fix:** Add a job tracking table in PostgreSQL and a status endpoint (`GET /admin/preload-status`).

---

## 3. Data Pipeline Analysis

### Full search flow (end-to-end):

1. **Frontend** `GET /api/search?q=San+Francisco&page=1`  
   → `normalizeQuery()` maps to `city="San Francisco", state="CA"`  
   → Calls `searchProperties({city, state, limit:50})` in `lib/api.ts`  
   → Fetches `http://192.168.1.88:8000/properties/search?city=San+Francisco&state=CA&limit=50`

2. **Backend** `search_properties()` in `properties.py`  
   → Checks in-memory cache (5-min TTL) — **cache miss** on first search  
   → Calls `redfin.search_listings(city="San Francisco", state="CA", limit=50)`

3. **Redfin scraper** (`redfin.py`)  
   → `_normalize_geo_query()` → `"San Francisco, CA, USA"`  
   → `_get_city_bbox()` → calls Nominatim OSM API (no key needed)  
   → Returns bounding box (e.g., `lat_min=37.7, lat_max=37.8, lng_min=-122.5, lng_max=-122.3`)  
   → Builds Redfin gis-csv URL with `poly=lng_min+lat_min,lng_max+lat_min,...`  
   → Fetches CSV, parses with `csv.DictReader`  
   → Returns list of 50 parsed property dicts (photo_url is `None` at this stage)

4. **Back to search_properties()**  
   → `_upsert_property()` for each listing — inserts or updates PostgreSQL  
   → Guards filter out listings with price < $50k or price/sqft < $50  
   → Schedules `_enrich_property(prop.id)` as background task for each property  
   → Returns all properties (up to `limit`) from DB

5. **Background enrichment** (`_enrich_property()`)  
   → Fetches noise from HowLoud (returns `{}` — no key)  
   → Fetches schools from Redfin listing page (scrapes `SchoolsListItem__heading` HTML)  
   → Fetches crime from city open data portal (SFPD for San Francisco)  
   → Computes `agg_data['scores']` via `scorer.py`  
   → Stores in `agg_data` JSONB column

6. **Front-end response**  
   → `adaptProperty()` maps `PropertyListItem` → `SearchProperty`  
   → Returns 10 results per page from the 50 fetched

### Data quality issues in the pipeline:

- **No photo URLs** on fresh listings (photo fetch happens in background, may lag)
- **Noise always null** (no HowLoud key)
- **Scores on wrong scale** (0–100 but frontend expects 0–10)
- **Lifestyle noise** never populated → compare page shows no noise
- **Price/sqft guard** ($50 minimum) may incorrectly filter some low-price high-sqft rural properties

---

## 4. Redfin Scraper Assessment

### Is it stable enough for production use?

**Answer: No, not as-is. Needs several hardening measures.**

**What works well:**
- Nominatim city resolution is free and reliable (no API key needed)
- CSV endpoint works for most markets most of the time
- JSON fallback catches cases where CSV is MLS-blocked
- Cache-at-db-level strategy (5-min in-memory) reduces redundant calls
- Guards catch scrape errors (bad price, bad sqft)
- Property type post-filtering is robust

**What can break:**
1. **Redfin changes the CSV format** — any new column rename breaks the parser silently. The `csv.DictReader` will return `None` for missing columns, resulting in properties with null addresses/cities/prices.
2. **Redfin adds bot detection** — if traffic patterns look automated (many rapid requests), Redfin may return 403 or CAPTCHA pages. No user-agent rotation or proxy infrastructure exists.
3. **Nominatim rate limits** — Nominatim has usage policy (~1 req/sec). If many users search many different cities in short succession, Nominatim will 429. There is no fallback (e.g., hardcoded bbox for known cities).
4. **JSON endpoint wrapper changes** — the `re.sub(r'^\{\}&&', '', resp.text)` regex is brittle. If Redfin changes the JS wrapper, parsing silently fails.
5. **Photo URL scraping** — `fetch_photo_url()` relies on `og:image` meta tag. If Redfin changes page structure (React SSR hydration changes), the regex fails.

**Legal/ethical concerns:**
- **Redfin's Terms of Service** generally prohibit automated scraping of their site. The gis-csv endpoint is an internal API not intended for third-party use.
- **Legal risk:** Using scraped Redfin data commercially may violate computer fraud laws. Real estate data is Redfin's core asset — they have strong incentive to pursue TOS violations.
- **Ethical consideration:** The application presents scraped data as if it's licensed. Users may not realize this is not official data.
- **Mitigation:** Use Redfin's official partner API or a licensed MLS data provider (like Spark API, Buildout, or real estate web scrapers that operate under data licensing agreements).

---

## 5. HowLoud API Null Investigation

**Root cause confirmed:** `HOWLOUD_API_KEY` is empty (placeholder value).

The howloud service returns `{}` immediately when the key is missing:
```python
if not settings.HOWLOUD_API_KEY or settings.HOWLOUD_API_KEY.startswith("your_"):
    return {}
```

This means **all 1,061 properties have no noise data** regardless of what's in the `.env`.

Additionally, even if the key were set, the **compare page would still not show noise data** because `_build_spec_row()` looks in `lifestyle` block (from Redfin page scrape), not `environment` block (from howloud). These are two separate data paths that don't connect.

To fix noise data end-to-end:
1. Get a HowLoud API key (free tier)
2. Set `HOWLOUD_API_KEY=your_key` in `backend/.env`
3. Fix `_build_spec_row()` to use `agg_data['environment']['noise_db']` instead of the wrong `lifestyle` keys

---

## 6. PostgreSQL Status

- **Container:** `spechouse_db` (postgis/postgis:16-3.4) — healthy, up 5 weeks
- **Record count:** 1,061 properties
- **Enrichment:** All 1,061 have `last_enriched` populated (range: 2026-03-31 to 2026-04-15)
- **Cities covered:** 21 (Seattle 337, SF 105, San Jose 60, Chicago 49, etc.)
- **Data is persisted** — not just in-memory. On restart, data survives.
- **Schema:** PropertyORM with JSONB `agg_data` column, PostGIS `geom` geography column for spatial queries
- **No connection pooling issues** detected — `pool_pre_ping=True` is set

---

## 7. NGrok Stability Assessment

**Current state:** Running as user-level process on PID 25222, tunnel to `matchable-hildegard-untransformed.ngrok-free.dev`.

**Production readiness: NOT SUITABLE.**

Key problems:
1. **No auto-restart** on crash — if the process dies, the app goes dark until manually restarted
2. **URL instability** — free ngrok URLs can change, and any restart will require updating `.env.production`
3. **Connection limits** — ngrok free tier has concurrent connection limits and session timeouts
4. **No HA** — single tunnel, single point of failure

**Recommended fix:** Use Cloudflare Tunnel (`cloudflared`) which is free, stable, and provides a fixed `trycloudflare.com` URL. Or deploy the backend to a proper hosting platform (Fly.io, Railway) with a persistent URL.

---

## 8. Summary: What's Working vs Not Working

### ✅ WORKING
- PostgreSQL persistence (1,061 properties, all enriched)
- Redfin scraper (live data confirmed working — returns 3 SF listings on test)
- Nominatim city resolution (free, reliable)
- School scraping from Redfin listing pages
- City open data crime API for SF and Austin
- Price-to-rent rental model (20 cities, Q1 2025 data)
- 5-minute in-memory search cache
- Background enrichment scheduler (6-hour cycle)
- City preloading endpoint
- DB schema with PostGIS for spatial queries
- Internal API key protection on admin endpoints

### ❌ NOT WORKING / BROKEN
- HowLoud API (no key — all noise data null)
- Noise display on compare page (wrong data path)
- Overall score display on frontend (0–100 vs 0–10 scale mismatch)
- Photo URLs on properties (null in DB, background fetch may not run)
- ngrok as production tunnel (unstable, no auto-restart)
- `.env` keys mostly empty (RentCast, SpotCrime, HowLoud all missing)
- No photo enrichment trigger for already-enriched properties

### ⚠️ PRODUCTION BLOCKERS
1. All external APIs unconfigured (HowLoud, RentCast)
2. ngrok tunnel not production-grade
3. Redfin scraper has no bot protection or rate limiting
4. Score scale mismatch makes all scores unreadable in UI
5. No authentication on lead submission endpoint
6. CORS too permissive

---

## 9. Priority Recommendations

| Priority | Issue | Fix Effort |
|----------|-------|-----------|
| P0 | Get HowLoud API key | 5 min (just set env var) |
| P0 | Fix score scale (0-10 vs 0-100) | 20 min (scorer.py divide by 10) |
| P0 | Fix noise display in compare | 15 min (compare.py data path fix) |
| P1 | Fix photo URL fetch for existing properties | 30 min (add to needs_enrich condition) |
| P1 | Replace ngrok with Cloudflare Tunnel | 15 min |
| P1 | RentCast API key for cities outside 30-city model | 5 min (set env var) |
| P2 | Harden Redfin scraper (fallback bboxes, rate limit) | 2 hrs |
| P2 | CORS restrict to explicit frontend domains | 10 min |
| P2 | Lead endpoint rate limiting | 30 min |
| P3 | True DB pagination in search | 1 hr |
| P3 | Alembic migrations | 1 hr |

---

*Review generated by SDET sub-agent. Test commands run: Redfin scraper (✅ live data), HowLoud API (✅ returns {}), PostgreSQL (✅ 1061 records), ngrok process (✅ running).*