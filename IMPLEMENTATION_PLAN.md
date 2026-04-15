# SpecHouse Implementation Plan

**Generated:** 2026-04-14
**Based on:** PM Review + SDE Tech Design
**Status:** For review before execution

---

## Priority Framework

| Priority | Meaning |
|----------|---------|
| P0 | MVP 必须有，launch 前必须完成 |
| P1 | Launch 后立即做，体验大幅提升 |
| P2 | v1.1 范围，可以等 |
| P3 | 未来版本，长期有价值 |

---

## TICKET Tiers

### 🔴 P0 — MVP Launch（必须完成）

#### T-01: Search + Autocomplete
**What:** City search with autocomplete, handles "SF" / "San Francisco" / "San Francisco CA" uniformly
**Files:** `app/search/page.tsx`, `components/SearchBar.tsx`
**Breakdown into commits:**
1. `feat: add city autocomplete API route with normalization logic`
2. `feat: build SearchBar component with debounced autocomplete dropdown`
3. `feat: connect autocomplete to search results page`
4. `fix: handle empty results state with suggestion to broaden filters`

---

#### T-02: Property Results with Skeleton + Error States
**What:** Results page with skeleton loaders, empty state, error state, last updated timestamp
**Files:** `app/search/page.tsx`, `components/PropertyCard.tsx`
**Breakdown into commits:**
1. `feat: add skeleton loader component for property cards`
2. `feat: add empty state UI when no results found`
3. `feat: add error state UI for API failures`
4. `feat: add last updated timestamp to result cards`

---

#### T-03: Compare Tray UX
**What:** Floating compare tray badge (always visible), expand to see/remove selected properties
**Files:** `components/CompareTray.tsx`, `context/CompareContext.tsx`
**Breakdown into commits:**
1. `feat: add CompareContext for tray state management`
2. `feat: build floating CompareTray badge with count`
3. `feat: add tray dropdown with remove-item functionality`
4. `feat: persist tray to localStorage`

---

#### T-04: Property Detail Page
**What:** Full detail page with Financials/Structure/Schools/Environment/Lifestyle sections, score breakdown
**Files:** `app/property/[id]/page.tsx`
**Breakdown into commits:**
1. `feat: add property detail page route with basic structure`
2. `feat: add score display with expandable "Why this score?" breakdown`
3. `feat: add price history card (last sold, price changes, DOM trend)`
4. `feat: add schools within 3 miles with rating/distance`
5. `feat: add noise level dB + bucket label (Quiet/Moderate/Loud)`
6. `feat: add "Add to Compare" button on detail page`

---

#### T-05: Comparison Table + Shareable URL
**What:** Side-by-side table with green/red highlighting, best-in-category callout, shareable URL
**Files:** `app/compare/page.tsx`, `components/CompareTable.tsx`
**Breakdown into commits:**
1. `feat: add compare page with URL param parsing (/compare?eids=...)`
2. `feat: build CompareTable component with section headers`
3. `feat: add green/red highlighting (best/lowest per row)`
4. `feat: add "Best in category" summary banner per section`
5. `feat: add copy-to-clipboard shareable URL button`
6. `feat: handle 2-4 property count validation in compare page`

---

#### T-06: Scoring Engine v1
**What:** Value / Investment / Environment sub-scores, weights adjustable, null handling
**Files:** `lib/scores.ts`, `lib/scoreConfig.ts`
**Breakdown into commits:**
1. `feat: add score configuration (weights: 40/35/25, bucket thresholds)`
2. `feat: implement value score with AVM discount + market velocity`
3. `feat: implement investment score with rental estimate + cap rate`
4. `feat: implement environment score with noise + crime + bucket labels`
5. `feat: add null/missing data handling (default 50, hide if >50% inputs missing)`
6. `feat: add score confidence interval (± range) display`
7. `feat: add localStorage-persisted weight customization UI`

---

#### T-07: Print-to-PDF
**What:** `@media print` CSS for compare page, watermark for anonymous, no watermark for logged-in
**Files:** `app/compare/page.tsx`, `styles/print.css`
**Breakdown into commits:**
1. `feat: add print-optimized CSS for compare page`
2. `feat: add SpecHouse watermark for anonymous users in print view`
3. `feat: suppress watermark for authenticated users`
4. `feat: add "Download PDF" button that triggers window.print()`

---

#### T-08: Lead Capture Form
**What:** "Want an agent to review this comparison?" form on compare page
**Files:** `components/LeadForm.tsx`, `app/api/leads/route.ts`
**Breakdown into commits:**
1. `feat: add lead form component (name, phone, email)`
2. `feat: add lead API route with validation`
3. `feat: add geographic agent matching (by city)`
4. `feat: add lead confirmation message after submit`

---

### 🟡 P1 — Post-LaUNCH IMMEDIATE

#### T-09: Onboarding Hero
**What:** Hero section with live example comparison, 3-score explainer icons
**Files:** `app/page.tsx`
**Breakdown into commits:**
1. `feat: redesign landing page hero with example property comparison`
2. `feat: add score explainer section (3 icons + 1-line descriptions)`
3. `feat: add primary CTA search bar in hero`

---

#### T-10: localStorage Favorites
**What:** Save/favorite properties without account, "Saved" tab
**Files:** `hooks/useFavorites.ts`, `app/saved/page.tsx`
**Breakdown into commits:**
1. `feat: add useFavorites hook with localStorage persistence`
2. `feat: add "Save" heart button on property cards`
3. `feat: add /saved page showing favorited properties`
4. `feat: add "unsave" functionality in saved page`

---

#### T-11: SEO + OpenGraph
**What:** Canonical URLs, OG tags, JSON-LD structured data for comparison pages
**Files:** `app/compare/page.tsx`, `lib/seo.ts`
**Breakdown into commits:**
1. `feat: add canonical URL and OpenGraph meta tags to compare page`
2. `feat: add JSON-LD structured data for property comparison`
3. `feat: add sitemap generation for all comparison pages`

---

#### T-12: Score Per-City Calibration
**What:** Percentile ranking per city instead of absolute scores
**Files:** `lib/scores.ts`
**Breakdown into commits:**
1. `feat: add city-based score normalization (percentile rank)`
2. `feat: add city property count requirement (min 10 properties to calibrate)`
3. `feat: add "city benchmark" tooltip showing percentile position`

---

### 🟢 P2 — v1.1

#### T-13: Full Auth (Google OAuth + Email)
**Files:** `app/auth/*`, `lib/auth.ts`
**Breakdown into commits:**
1. `feat: add Supabase auth setup`
2. `feat: add email/password signup + login`
3. `feat: add Google OAuth`
4. `feat: add session management + protected routes`
5. `feat: add account dashboard with cross-device sync`

---

#### T-14: Price Drop Alerts
**Files:** `app/api/alerts/route.ts`, `lib/alertScheduler.ts`
**Breakdown into commits:**
1. `feat: add saved search alert model`
2. `feat: add daily check job against new listings`
3. `feat: add email notification with direct comparison link`

---

#### T-15: Score Confidence Intervals
**What:** Show "Value: 72 ± 8" with confidence band visualization
**Files:** `components/ScoreDisplay.tsx`
**Breakdown into commits:**
1. `feat: add confidence interval calculation to scoring engine`
2. `feat: add confidence band UI component (error bar visualization)`
3. `feat: add "how we calculated this" tooltip with confidence notes`

---

### 🔵 P3 — Future

#### T-16: Agent Subscription Tier (CRM integration)
#### T-17: City Guide Content Pages
#### T-18: Custom PDF Branding (brokerage logo, colors)

---

## Testing Plan Per Ticket

**Unit Tests:**
- Scoring engine: null handling, weight calculations, confidence intervals
- Lead form: validation (email format, phone format, required fields)
- Compare tray: max 4 items enforcement, localStorage persistence

**Integration Tests:**
- Search → results → add to tray → compare page flow
- Autocomplete: normalize "SF" / "San Francisco CA" → same results
- Print: anonymous watermark visible, authenticated no watermark

**E2E Tests (Playwright):**
1. Search for city → results in < 3 seconds
2. Add 2 properties to compare tray
3. Open compare page, verify highlighting
4. Click share → copy URL → open in new tab → same content
5. Submit lead form → confirmation message
6. Print compare page → PDF generated with watermark

**Performance Tests:**
- Search response time < 3 seconds (Lighthouse CI)
- Compare page load < 2 seconds
- Core Web Vitals: LCP < 2.5s, CLS < 0.1

---

## Not Doing (Cut from scope)

- ~~ML price prediction~~ — too expensive, defer to v2
- ~~NLP semantic search~~ — Postgres LIKE is sufficient for v1
- ~~Real-time SSE~~ — polling is fine until v1.1
- ~~Native mobile app~~ — responsive web covers 95% of use cases
- ~~Full account system in MVP~~ — localStorage first
---

## Post-Launch Bug Fixes (from QA Testing — 2026-04-14)

### 🔴 T-B01: Fix 0 Results Bug on Vercel Deployment
**What:** Search returns 0 results on the live deployment because `NEXT_PUBLIC_API_URL` env var causes mock fallback to be skipped.
**Root cause:** `lib/api.ts` — `if (process.env.NEXT_PUBLIC_API_URL) return null;` in `getPropertyDetail`
**Fix:** Either: (a) remove the env var from Vercel, OR (b) make mock data work even when `NEXT_PUBLIC_API_URL` is set for demo purposes
**Severity:** Critical — Complete blocker, no users can search
**Files:** `lib/api.ts`
**Breakdown:**
1. `fix: disable API URL env var check for demo mode`
2. `test: verify mock data returns for known cities on deployed site`

---

### 🔴 T-B02: Add Loading Skeleton During Search
**What:** No loading feedback when searching — results appear suddenly
**Files:** `app/listings/page.tsx`
**Fix:** Show skeleton cards while API is fetching, add `isLoading` state
**Severity:** High — Poor UX, users think it's broken
**Breakdown:**
1. `feat: add loading skeleton state to listings page`
2. `test: verify skeleton shows during fetch`

---

### 🔴 T-B03: Add Error/Empty State for 0 Results
**What:** When search returns 0 results, show helpful message ("Try nearby city or broaden filters")
**Files:** `app/listings/page.tsx`
**Severity:** High — Users have no guidance on what to do
**Breakdown:**
1. `feat: add empty state with suggestions when no results`
2. `test: empty state renders correctly with 0 results`

---

### 🟡 T-B04: Lead Form Confirmation UX
**What:** After lead form submit, user gets no confirmation or next steps
**Files:** `components/LeadForm.tsx`
**Fix:** Show clear success message + "Check your email for confirmation" + agent timeline
**Severity:** High — Without confirmation, users think the form didn't work
**Breakdown:**
1. `feat: add confirmation message after lead form submit`
2. `test: confirmation shows after successful submit`

---

### 🟡 T-B05: Agent Dashboard for Lead Management
**What:** Agents have no way to see or manage leads they receive
**Files:** New route `app/agent/dashboard/page.tsx`
**This is the monetization blocker** — without this, agents won't pay
**Severity:** Critical for monetization
**Breakdown:**
1. `feat: add agent dashboard page`
2. `feat: add lead list view with property details`
3. `feat: add contact buyer button`
4. `test: dashboard renders with mock leads`

---

### 🟡 T-B06: Professional PDF Generation (Server-side)
**What:** Browser print-to-PDF is inconsistent and unprofessional
**Files:** New API route + PDF library (puppeteer or @react-pdf/renderer)
**Fix:** Server-side PDF generation with agent branding support
**Severity:** Critical for agent adoption
**Breakdown:**
1. `feat: add server-side PDF generation API route`
2. `feat: add agent branding (name, logo, colors) to PDF`
3. `feat: add PDF download button that calls server API`
4. `test: PDF generates with correct content and branding`

---

### 🟡 T-B07: Score Explanation for Non-Technical Users
**What:** Score tooltips are too technical for average home buyers
**Files:** `components/ScoreDisplay.tsx`, `lib/scores.ts`
**Fix:** Replace technical breakdowns with plain-English explanations
**Example:** Instead of "AVM discount ratio: 0.08" → "Priced 8% below market value"
**Severity:** Medium — Without this, scores don't help users decide
**Breakdown:**
1. `feat: add human-readable score explanations`
2. `feat: add "What this means" tooltip for each score`
3. `test: explanations render correctly`

---

### 🟢 T-B08: Saved Page Hydration Fix
**What:** /saved page sometimes shows empty state even when favorites exist
**Files:** `app/saved/page.tsx`, `hooks/useFavorites.ts`
**Fix:** Ensure localStorage hydration happens before render
**Severity:** Low — Minor persistence issue
**Breakdown:**
1. `fix: add loading state while hydrating from localStorage`
2. `test: saved page renders correctly after hydration`

---

## v1.1 Pipeline (After Agent Dashboard + PDF)

### T-B09: CRM Integration
- HubSpot / Salesforce webhook on lead submission
- Auto-create contact in agent's CRM

### T-B10: "Best in Comparison" AI Summary
- Generate one-paragraph summary of the comparison
- "Property A offers the best value, priced 12% below market..."

### T-B11: Data Source Attribution
- Show data sources (Redfin, HowLoud, etc.) on each data point
- Build trust through transparency
