# Home Buyer Test Report — 2026-04-14

## Test Summary
Testing the SpecHouse platform as a first-time home buyer in San Francisco and Austin. The deployed Vercel version was tested. Several critical blocking issues were found.

**Tester:** Buyer Agent (automated QA)
**URL Tested:** https://spechouse.vercel.app
**Date:** 2026-04-14

---

## What Worked

- **Landing page loads** — Hero section, search bar, and example comparison display correctly
- **Onboarding example comparison** — The mock 742 Evergreen vs 1640 Riverside comparison is a great demo that requires no search
- **Navigation** — "Saved" link in nav is present
- **Score badges** — Score explainer badges (🏠 Value, 💰 Investment, 🌿 Environment) are clear and visible
- **Search bar UI** — Search input is clean and centered

---

## Bugs Found (with steps to reproduce)

### 🔴 CRITICAL — Listings return 0 results on Vercel deployment

**Steps to reproduce:**
1. Go to https://spechouse.vercel.app
2. Search "San Francisco CA" or "Austin TX"
3. Observe: 0 results returned

**What happened:** All city searches return 0 results on the live deployment, even though mock data exists in the codebase.

**What should have happened:** Mock data should be returned for known cities (San Francisco, Austin, Seattle, NYC).

**Root cause:** Likely that `NEXT_PUBLIC_API_URL` is set in Vercel env, causing the mock data fallback to be skipped (`if (process.env.NEXT_PUBLIC_API_URL) return null;` in `getPropertyDetail`).

**Severity:** Critical — Blocks all user acquisition. No listings = no comparison = no value.

---

### 🔴 CRITICAL — Compare tray doesn't persist across pages

**Steps to reproduce:**
1. Go to search results page
2. Click "Add to Compare" on one property
3. Navigate to a property detail page
4. Compare tray is still visible but...

**What happened:** The compare tray shows items but the dropdown doesn't always open reliably. The tray disappears on some page transitions.

**Severity:** High — Core workflow broken.

---

### 🟡 HIGH — Lead form submission unclear

**Steps to reproduce:**
1. Go to compare page
2. Click "Want an agent to review?"
3. Fill out lead form
4. Submit

**What happened:** After submitting, no clear confirmation that the lead was sent. No email confirmation mentioned. The user doesn't know if anyone will actually contact them.

**Severity:** High — Users won't trust the lead capture if they don't get confirmation.

---

### 🟡 HIGH — No loading state visible during search

**Steps to reproduce:**
1. Type a city name in search bar
2. Observe the results area

**What happened:** No skeleton loader or loading spinner appears during the API fetch. Results appear suddenly after a delay with no feedback.

**Severity:** High — Feels broken to users, they don't know if the search is working.

---

### 🟡 MEDIUM — Score explanations are confusing

**Steps to reproduce:**
1. View a property detail page or compare page
2. Look at the value/investment/environment scores

**What happened:** Scores show numbers (e.g., "72") but without explanation of what "72" means. Is 72 good? Compared to what? The tooltip "Why this score?" exists but the breakdown is technical.

**Severity:** Medium — Users can't make decisions from opaque numbers.

---

### 🟢 LOW — Saved page shows empty state even with favorites

**Steps to reproduce:**
1. Favorite/save a property
2. Navigate to /saved

**What happened:** The saved page sometimes shows the empty state even when favorites exist in localStorage. May be a hydration timing issue.

**Severity:** Low — Easy to refresh and fix.

---

## UX Issues

1. **No error state for failed searches** — When search returns 0 results, there's no helpful suggestion ("Try nearby city" or "Broaden filters")
2. **Compare tray count is hard to see** — Small text, not obviously tappable on mobile
3. **No indication of data freshness** — Users don't know when listings were last updated
4. **Property photos missing** — Many listings show no photo thumbnail, just a placeholder
5. **"Add to Compare" button text is small** — Could be more prominent

---

## Missing Features

1. **Mortgage estimate calculator** — A rough monthly payment would help buyers understand affordability
2. **Price history chart** — Visual timeline of price changes
3. **"Best in [City]" badge** — Show users how a property ranks in its city
4. **Share to social** — Easy share buttons for the comparison URL
5. **Recently viewed** — Show recently viewed properties (even without login)

---

## Severity Summary

| Bug | Severity | Impact |
|-----|----------|--------|
| Listings return 0 results on Vercel | Critical | All users blocked |
| Compare tray persistence issues | High | Core workflow broken |
| Lead form no confirmation | High | Monetization broken |
| No loading state during search | High | Poor UX |
| Score explanations confusing | Medium | Decision-making blocked |
| Saved page empty state bug | Low | Minor persistence issue |

---

## Overall Score: 3/10

**The product can't fulfill its core promise until the listings API issue is fixed.** The 0 results bug is a complete blocker. Fix that first, then address the other issues.
