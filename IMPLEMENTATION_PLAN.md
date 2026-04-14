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