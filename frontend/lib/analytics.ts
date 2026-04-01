'use client';

import ReactGA from 'react-ga4';

// GA4 Measurement ID — set via NEXT_PUBLIC_GA4_ID env var
// To get your ID: https://analytics.google.com → Admin → Data Streams → Web Stream → Measurement ID
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

let initialized = false;

function ensureInit() {
  if (!initialized && GA4_ID) {
    ReactGA.initialize(GA4_ID);
    initialized = true;
    console.log('[GA4] Initialized with ID:', GA4_ID);
  }
}

// ── Raw event helper ────────────────────────────────────────
export function trackEvent(action: string, params?: Record<string, string | number | boolean>) {
  ensureInit();
  if (!initialized) return;
  ReactGA.event(action, params);
}

// ── GA4 event names ─────────────────────────────────────────
export const AnalyticsEvents = {
  SEARCH: 'search',
  SEARCH_RESULTS: 'search_results',
  PROPERTY_VIEW: 'property_view',
  PROPERTY_CLICK: 'property_click',
  COMPARE_ADD: 'compare_add',
  COMPARE_REMOVE: 'compare_remove',
  COMPARE_OPEN: 'compare_open',
  COMPARE_SHARE: 'compare_share',
  PDF_EXPORT: 'pdf_export',
  CHAT_OPENED: 'chat_opened',
  AGENT_CLICK: 'agent_click',
} as const;

// ── Legacy analytics object (used by existing pages) ────────
// Maintains API surface for pages already calling analytics.trackSearch()
export const analytics = {
  trackSearch({
    city,
    zipCode,
    beds,
    maxPrice,
    propertyType,
  }: {
    city?: string;
    zipCode?: string;
    beds?: number;
    maxPrice?: number;
    propertyType?: string;
  }) {
    trackEvent(AnalyticsEvents.SEARCH, {
      city: city ?? '',
      zip_code: zipCode ?? '',
      beds: beds ?? 0,
      max_price: maxPrice ?? 0,
      property_type: propertyType ?? '',
    });
  },

  trackPageView(url: string) {
    ensureInit();
    if (!initialized) return;
    ReactGA.send({ hitType: 'pageview', page: url });
  },

  trackEvent,
};
