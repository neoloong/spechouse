'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';

export default function GA4Provider() {
  useEffect(() => {
    // Initialize GA4 by sending an initial pageview
    analytics.trackPageView(window.location.pathname);
  }, []);

  return null;
}
