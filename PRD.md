# SpecHouse PRD

**Last updated:** 2026-04-13
**Status:** Draft → In Review
**Author:** Neo

---

## 1. Problem Statement

Home buyers comparing multiple properties face a fragmented experience:

- Price, school, noise, and crime data scattered across Zillow, Redfin, HowLoud, and Google Maps
- No tool exists to put 2-4 properties side-by-side with a meaningful spec comparison
- Agents spend hours manually assembling comparison reports for clients
- Existing platforms are ad-driven and prioritize agent referrals over buyer interests

---

## 2. Target Users

### Primary
**Home buyers actively comparing 2+ properties**
- Data-driven, want transparency, tired of ads
- Comparing before making an offer

### Secondary
**Buyer's agents**
- Need to present professional comparison reports to clients
- Want a tool that makes them look prepared and thorough

### Out of Scope (for now)
- Sellers
- Renters
- Commercial real estate
- AI agent / API consumers

---

## 3. Product Overview

SpecHouse is a real estate comparison platform that aggregates structured property data — price, sqft, schools, noise, crime, rental estimates — and lets users compare any 2-4 properties spec-by-spec in a single view.

Analogy: GSMarena for homes. Levels.fyi for salaries.

---

## 4. Feature Requirements

### 4.1 — Property Search
**The user searches for properties by city and gets a list of results.**

- Search by city name (e.g. "San Francisco CA", "Austin TX")
- Results display: address, price, beds, baths, sqft, photo thumbnail
- Each result shows: overall score badge, key investment metrics
- User can filter by: beds, baths, price range, property type, sqft
- List is sorted by SpecHouse overall score (descending) by default

### 4.2 — Property Detail
**The user views full details for a single property.**

- All specs displayed in structured sections: Financials, Structure, Schools, Environment, Lifestyle
- SpecHouse scores shown prominently (overall + sub-scores: value, investment, environment)
- Schools within 3 miles listed with rating, type, and distance
- Noise level (dB) and label shown if available
- Crime safety score shown if available
- "Add to Compare" button on every card and detail page

### 4.3 — Spec Comparison
**The user selects 2-4 properties and compares them side-by-side.**

- Full spec-by-spec table across all selected properties
- Highest value in each row highlighted green, lowest highlighted red
- Sections mirror detail page: Financials, Market Comparison, Structure, Schools, Environment, Lifestyle
- Shareable URL generated for the comparison (e.g. `/compare?eids=redfin_123,redfin_456`)
- Comparison accessible without login

### 4.4 — Scoring System
**Every property receives a 0-100 overall score and three sub-scores.**

- **Value score:** how price compares to AVM estimate (discount → higher score)
- **Investment score:** rental yield + cap rate weighted
- **Environment score:** noise level + crime safety (inverse — lower noise/crime → higher score)
- Overall score = weighted average of sub-scores
- Scores are unitless and comparable across markets

### 4.5 — PDF Report (Agent use)
**An agent generates a branded PDF report from a comparison.**

- PDF includes: selected properties, all specs, scores, schools, recommended property
- Agent name / brokerage logo customizable
- One-click generate from compare page
- Download as PDF, no email required

### 4.6 — User Accounts
**Users can save searches, favorite properties, and track history.**

- Sign up with email + password or Google OAuth
- Saved properties persist across sessions
- Search history accessible from account dashboard

---

## 5. User Stories

### As a home buyer
- I can search by city and see results in < 3 seconds
- I can add properties to a compare tray and view a side-by-side table
- I can understand at a glance which property has the best value / investment potential
- I can share a comparison URL with my partner or agent

### As a buyer's agent
- I can generate a professional PDF report in one click
- I can customize the report with my name and brokerage
- I can send the shareable link to my client before a showing

---

## 6. Out of Scope

The following are explicitly not part of this PRD:

- Property listing / posting (we are not a listing site)
- Mortgage calculator integration
- Neighborhood reviews / community content
- Mobile native app
- API for third-party developers
- Scheduling / agent booking

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Search completion rate | > 70% of searches return ≥ 1 result |
| Compare conversion | > 20% of searchers add a 2nd property to compare tray |
| Time to first compare | < 2 minutes from landing on site |
| Agent PDF download | ≥ 1 per week within 30 days of launch |
| NPS (30-day survey) | ≥ 40 |

---

## 8. Open Questions

1. Should scores be calibrated per-city or absolute across all markets?
2. Do we require login to generate PDF, or allow anonymous with watermark?
3. What is the data retention policy for saved searches?
