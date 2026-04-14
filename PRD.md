# SpecHouse PRD — v2.0 (Updated 2026-04-14)

**Last updated:** 2026-04-14
**Status:** In Review → Revising
**Author:** Neo + PM Review

---

## 1. Problem Statement

Home buyers comparing multiple properties face a fragmented experience:

- Price, school, noise, and crime data scattered across Zillow, Redfin, HowLoud, and Google Maps
- No tool exists to put 2-4 properties side-by-side with a meaningful spec comparison
- Agents spend hours manually assembling comparison reports for clients
- Existing platforms are ad-driven and prioritize agent referrals over buyer interests

**What users actually need:** A way to understand which property is genuinely better — not just more expensive or prettier, but better value, better investment, better livability — without leaving the platform.

---

## 2. Target Users

### Primary
**Home buyers actively comparing 2-4 properties**
- Data-driven, want transparency, tired of ads
- Comparing before making an offer
- Need to justify decision to partner/spouse

### Secondary
**Buyer's agents**
- Need to present professional comparison reports to clients
- Want a tool that makes them look prepared and thorough

### Out of Scope (for now)
- Sellers, Renters, Commercial real estate, AI agent / API consumers

---

## 3. Product Overview

SpecHouse is a real estate comparison platform that aggregates structured property data — price, sqft, schools, noise, crime, rental estimates, price history — and lets users compare any 2-4 properties spec-by-spec in a single view.

**Analogy:** GSMarena for homes. Levels.fyi for salaries.

**Core differentiator:** We don't just list properties — we score and rank them so users can make decisions faster.

---

## 4. Core User Flows

### 4.0 — Onboarding (NEW)
**First-time user lands on the site and immediately understands the value.**

- Hero section shows a live example comparison (2 real properties, side-by-side)
- Headline: "See which property is actually worth more"
- One visible search bar, prominent
- Below fold: mini explainer of how scores work (3 icons, 3 seconds to understand)

### 4.1 — Property Search
**The user searches for properties by city and gets results in < 3 seconds.**

- Search by city name with **autocomplete** (handles "SF" / "San Francisco" / "San Francisco CA" uniformly)
- Results display: address, price, beds, baths, sqft, photo thumbnail
- Each result shows: overall score badge, key investment metrics
- **Filter UX:** Instant apply (no "Apply" button), collapsible filter panel, shows result count per filter option
- List sorted by SpecHouse overall score (descending) by default
- **Skeleton loader** during fetch
- **Empty state:** "No results in [City]. Try nearby city or broaden filters."
- **Error state:** "Search temporarily unavailable. Try again in a moment."
- Last updated timestamp on each result card ("Updated Apr 12")

### 4.2 — Property Detail
**The user views full details for a single property.**

- All specs displayed in structured sections: Financials, Structure, Schools, Environment, Lifestyle
- **SpecHouse scores** shown prominently with **expandable breakdown** ("Why this score? → tap to see calculation")
- Schools within 3 miles listed with rating, type, and distance
- Noise level (dB) + bucket label shown if available (e.g., "62 dB — Moderate")
- Crime safety score shown if available
- **Price history card:** Last sold date, price changes over last 12 months, days on market trend
- "Add to Compare" button on every card and detail page

### 4.3 — Spec Comparison
**The user selects 2-4 properties and compares them side-by-side.**

- Full spec-by-spec table across all selected properties
- **Highest value → green highlight, lowest → red highlight** (per row)
- **Best in category callout:** "Best value: Property A" / "Best schools: Property B" summary banner
- Sections mirror detail page: Financials, Market Comparison, Structure, Schools, Environment, Lifestyle
- **Shareable URL** generated (e.g., `/compare?eids=redfin_123,redfin_456`)
- Comparison accessible without login
- **Compare tray:** Always visible floating badge showing count (e.g., "2 selected") — click to expand/remove

### 4.4 — Scoring System (REVISED)
**Every property receives a 0-100 overall score and three sub-scores.**

| Score | Weight | Input Data | Notes |
|-------|--------|------------|-------|
| **Value** | 40% | AVM estimate vs list price, market velocity (days on market, price cut frequency) | Calibrated per-city. AVM unavailable → neutral 50, flag in UI |
| **Investment** | 35% | Rental estimate, cap rate, property tax, insurance | Show confidence interval (± range), not just point estimate |
| **Environment** | 25% | Noise (dB), crime safety, flood/wildfire risk, walkability | Noise bucketed: Quiet (<50dB) / Moderate (50-65dB) / Loud (>65dB) |

- **Null data handling:** Any score with >50% missing inputs → score hidden with note "Insufficient data"
- **Score calibration:** Per-city percentile ranking, not absolute numbers (allows fair cross-market comparison)
- **Score weights adjustable** in UI (slider: "I care more about investment returns" — saves to localStorage for anonymous, account for logged-in)
- Scores displayed with confidence indicator: "Value: 72 ± 8"

### 4.5 — PDF Report (REVISED — MVP scope reduced)
**An agent generates a PDF report from a comparison.**

- MVP: Browser print-to-PDF via `@media print` CSS — no server-side generation
- PDF includes: selected properties, all specs, scores, schools, recommended property
- Anonymous users: watermark "Generated by SpecHouse"
- Logged-in users: no watermark
- **Deferred to v1.1:** Custom branding (agent name, brokerage logo, custom colors)
- Agent capture: before PDF download, prompt "Enter your email to receive a branded version" (drives signup, not paywall)

### 4.6 — User Accounts (REVISED — MVP scope reduced)
**Users can save searches, favorite properties, and track history.**

- **v1 MVP:** localStorage-based favorites + search history (no auth required)
- **v1.1:** Email + Google OAuth signup, sync across devices
- Saved properties accessible from persistent "Saved" tab
- Search history with "rerun" option
- **Deferred to v1.1:** Password reset, session management, OAuth account linking

### 4.7 — Lead Capture (NEW — Primary Monetization)
**Monetize via lead gen, not software subscriptions.**

- Free comparison for all users
- Gate: "Want an agent to review this comparison?" → form with name, phone, email
- Lead sent to matched local agent (by city)
- Anonymous users: can submit lead, prompted to create account afterward
- Agent pays for leads, not software (TBD pricing: $20-50/lead)

### 4.8 — Price Drop Alerts (NEW — Retention)
**Users get notified when matching properties hit the market.**

- User saves search criteria (city, beds, baths, price range)
- Background job checks new listings against criteria daily
- Email notification with direct link to comparison
- Requires account (v1.1)

### 4.9 — SEO / Content Flywheel (NEW — Growth)
**Drive organic traffic via comparison pages and city guides.**

- Each comparison URL has canonical URL, OpenGraph tags, JSON-LD structured data
- City/neighborhood guide pages ("Top 10 neighborhoods in Austin for families") embedded with live comparisons
- Schema markup for Google Rich Results

---

## 5. User Stories

### As a home buyer
- I can search by city and see results in < 3 seconds
- I can add properties to a compare tray and view a side-by-side table
- I can understand at a glance which property has the best value / investment potential **and why**
- I can share a comparison URL with my partner or agent
- I can see at a glance which property is "best" in each category without reading every cell

### As a buyer's agent
- I can generate a comparison PDF in one click (free, with watermark)
- I can capture leads from my clients who use the platform
- I can send the shareable link to my client before a showing

---

## 6. Out of Scope

- Property listing / posting
- Mobile native app (responsive web is in scope)
- API for third-party developers
- Scheduling / agent booking
- ML-based price prediction
- NLP / semantic search

---

## 7. Success Metrics (REVISED)

| Metric | Target |
|--------|--------|
| Search completion rate | > 70% of searches return ≥ 1 result |
| Compare conversion | > 25% of searchers add a 2nd property (up from 20%) |
| Time to first compare | < 2 minutes from landing on site |
| Lead form completion | > 5% of compare page visitors submit agent request |
| Account sign-up rate | > 10% of lead submitters create account |
| NPS (30-day survey) | ≥ 40 |

---

## 8. Open Questions

1. ~~Should scores be calibrated per-city or absolute?~~ → **RESOLVED: Per-city percentile ranking**
2. Do we require login to generate PDF, or allow anonymous with watermark? → **RESOLVED: Anonymous allowed with watermark, logged-in no watermark**
3. What is the data retention policy for saved searches? → TBD (legal)
4. Agent lead routing: city-based geographic match, or highest-rated agent?
5. What is the minimum data completeness before showing a score? → **50% of inputs available**

---

## 9. Roadmap Phases

### v0.9 — MVP Core (Current Sprint)
- Property search + results
- Property detail
- Comparison table + shareable URL
- Basic scoring (3 sub-scores, adjustable weights)
- Compare tray UX

### v1.0 — Launch
- Print-to-PDF
- localStorage favorites
- Autocomplete search
- Onboarding hero
- Lead capture form
- Error/empty/loading states

### v1.1 — Retention & Engagement
- Full auth (Google OAuth)
- Price drop alerts
- Email saved search
- Score confidence intervals

### v2.0 — Scale
- Agent subscription tier (CRM integration)
- City guide content pages
- Custom PDF branding