# Agent Test Report — 2026-04-14

## Test Summary
Testing SpecHouse as a buyer's agent evaluating whether to recommend this tool to clients. Tested PDF export, lead capture, score explanations, and client presentation quality.

**Tester:** Agent Tester (automated QA)
**URL Tested:** https://spechouse.vercel.app
**Date:** 2026-04-14

---

## What Works for Agents

- **Compare table layout** — The side-by-side table is clean and readable for client presentations
- **Green/red highlighting** — Immediately shows best/worst per row — useful for client discussions
- **Best in category banners** — "🏆 Best Value: [address]" is a nice summary that saves agent time
- **Shareable URL** — The `/compare?ids=...` URL is simple and can be sent to clients before a showing
- **Score badges on cards** — Agents can quickly show clients the overall score
- **No-login comparison** — Clients don't need to sign up to use the compare feature

---

## Features You'd Actually Use

1. **Print-to-PDF** — The compare page print is genuinely useful for pre-showing handouts
2. **Shareable comparison link** — Sending a URL before a showing is better than nothing
3. **Agent lead capture** — If it actually delivers leads, this is the main value prop

---

## Missing Agent Features

### 🔴 CRITICAL — No agent branding / customization

**Issue:** The PDF has no option to add agent name, brokerage logo, or contact info.

**What agents need:**
- "Prepared by: [Agent Name], [Brokerage]"
- Brokerage logo in PDF header
- Custom colors/branding for their business
- Contact info footer

**Without this, agents can't use it as a professional deliverable.**

---

### 🔴 CRITICAL — Print PDF quality is poor

**Issue:** The browser print-to-PDF (window.print()) produces inconsistent results:
- Different browsers = different formatting
- No control over page breaks
- Header/footer auto-added by browser
- Mobile print is nearly unusable

**What agents need:** A server-generated PDF that's consistent, branded, and professional.

---

### 🟡 HIGH — Lead capture delivers no value without agent dashboard

**Issue:** The lead form says "We'll connect you with a local agent" but there's no way for me (as an agent) to:
- See who submitted the lead
- Contact the buyer
- Track which properties they're interested in
- Follow up

**As an agent, I would never pay for a service that takes my clients away from me without giving me access.**

---

### 🟡 HIGH — No CRM integration

**Issue:** Even if leads are delivered, there's no CRM integration (Salesforce, HubSpot, etc.).

**Agents need:** Leads to flow directly into their existing workflow, not a separate dashboard they'll never check.

---

### 🟡 MEDIUM — Score methodology is opaque

**Issue:** The scores (value: 72, investment: 68) are numbers without enough context.

**As an agent, I need to defend these numbers to clients.** "Why is this property's value score 72?" The tooltip explanation is technical ("AVM discount ratio...") not client-friendly.

**What clients want to hear:** "This property is priced 8% below market value, which is rare in this neighborhood."

---

### 🟡 MEDIUM — No "Why is this a good deal?" summary

**Issue:** The compare table shows data but doesn't generate insights.

**What agents want:** A one-paragraph summary like: "Property A offers the best value in this comparison, priced 12% below AVM with strong rental yield. Property B has the best schools but is overpriced for the area."

---

## Client Presentation Quality

| Aspect | Rating | Notes |
|--------|--------|-------|
| Table readability | ✅ Good | Clean, scannable |
| Score visibility | ⚠️ OK | Numbers are visible but unexplained |
| Visual hierarchy | ⚠️ OK | Green/red highlighting helps but could be clearer |
| Mobile experience | ❌ Poor | Table is hard to read on phone |
| Print quality | ❌ Poor | Browser print is not professional |
| Overall impressiveness | ⚠️ OK | Looks decent but not "wow" |

---

## Lead Capture Evaluation

**What it does well:**
- Form is simple (name, phone, email)
- Shows up on the compare page where intent is highest
- No login required to submit

**What's broken:**
- No confirmation email to the buyer
- No notification to the agent
- No agent dashboard to manage leads
- No follow-up automation

**Verdict:** Lead capture is worthless without agent access to leads. As an agent, I'd want to be the one receiving the leads, not paying for a tool that sends my potential clients elsewhere.

---

## Concerns / Red Flags

1. **Who is the customer?** The product tries to serve both buyers and agents but optimizes for neither. Buyers can't search (0 results bug). Agents can't get leads without a dashboard.

2. **Data accuracy** — Schools, noise, crime data all appear to be mock/placeholder. If this is real data, there's no source attribution. If it's fake, it's misleading.

3. **No MLS data** — Real estate platforms live or die by listing accuracy. Without Redfin/Zillow-level data, agents won't trust it.

4. **The PDF is a commodity** — Zillow, Redfin, Realtor.com all have PDF export. There's nothing here that competitors don't already have.

---

## Would You Pay? Why or why not?

**No.** Not in the current state.

**Reasons:**
1. The 0 results bug means the product doesn't work
2. No agent dashboard = no way to see or manage leads
3. PDF quality is not professional enough for client handouts
4. No branding customization means it can't represent my business
5. I'd need to pay to get my own leads sent to me — that's backwards
6. If I want a comparison tool, I can use Zillow's side-by-side for free

**What would make me pay:**
- Working search with real MLS data
- Agent dashboard with lead management
- Custom-branded PDF without watermarks
- CRM integration (HubSpot, Salesforce)
- API access to embed on my website

---

## Severity Summary

| Issue | Severity |
|-------|----------|
| No agent branding on PDF | Critical |
| Print PDF quality poor | Critical |
| Lead capture has no agent dashboard | High |
| No CRM integration | High |
| Score explanations too technical | Medium |
| No insight summary generation | Medium |
| 0 results on deployed site | Critical (blocking) |

---

## Overall Score: 2/10

**As an agent, I would not recommend this product in its current state.** The 0 results bug is a complete blocker, and even if that were fixed, the missing agent features (branding, lead dashboard, CRM integration) mean there's no path to monetization. The product needs a significant rebuild of the agent-facing features before it can be sold.
