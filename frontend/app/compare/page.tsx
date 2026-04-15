import type { Metadata } from "next";
import CompareClient from "@/components/CompareClient";

// ── SEO metadata (server component, runs at build/request time) ─────────────

export async function generateMetadata(): Promise<Metadata> {
  // Properties are loaded client-side from URL params, so we use
  // a static title/description and set the canonical URL generically.
  // The real dynamic meta (per-property) is set client-side via helmet.
  return {
    title: "Compare Properties | SpecHouse",
    description: "Side-by-side comparison of properties. View value, investment, and environment scores.",
    alternates: {
      canonical: "/compare",
    },
    openGraph: {
      title: "Compare Properties | SpecHouse",
      description: "Side-by-side comparison of properties. View value, investment, and environment scores.",
      type: "article",
      url: "/compare",
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  return <CompareClient />;
}