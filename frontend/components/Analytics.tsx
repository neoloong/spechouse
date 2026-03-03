"use client";

import { useEffect } from "react";
import Script from "next/script";

// TODO: Replace G-XXXXXXXXXX with actual GA4 measurement ID
export default function Analytics() {
  useEffect(() => {
    // Custom tracking events
    window.gtag = window.gtag || function(...args: any[]) {
      (window.dataLayer = window.dataLayer || []).push(arguments);
    };
  }, []);

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        strategy="afterInteractive"
      />
      <Script id="ga-data" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');
        `}
      </Script>
    </>
  );
}