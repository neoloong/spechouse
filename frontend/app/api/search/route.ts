import { NextRequest, NextResponse } from "next/server";
import { searchProperties, type PropertyListItem } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchProperty {
  id: number;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  photoUrl: string;
  overallScore: number;
  lastUpdated: string;
}

export interface SearchResult {
  properties: SearchProperty[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── City normalization ──────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, { city: string; state: string }> = {
  sf: { city: "San Francisco", state: "CA" },
  "san fran": { city: "San Francisco", state: "CA" },
  "san francisco": { city: "San Francisco", state: "CA" },
  "san francisco ca": { city: "San Francisco", state: "CA" },
  "san francisco, ca": { city: "San Francisco", state: "CA" },
  "san francisco, california": { city: "San Francisco", state: "CA" },
  austin: { city: "Austin", state: "TX" },
  "austin tx": { city: "Austin", state: "TX" },
  "austin, tx": { city: "Austin", state: "TX" },
  seattle: { city: "Seattle", state: "WA" },
  "seattle wa": { city: "Seattle", state: "WA" },
  "seattle, wa": { city: "Seattle", state: "WA" },
  nyc: { city: "New York", state: "NY" },
  "new york": { city: "New York", state: "NY" },
  "new york ny": { city: "New York", state: "NY" },
  "new york, ny": { city: "New York", state: "NY" },
  manhattan: { city: "New York", state: "NY" },
};

const CITY_KEYWORDS: Record<string, { city: string; state: string }> = {
  "san francisco": { city: "San Francisco", state: "CA" },
  sf: { city: "San Francisco", state: "CA" },
  austin: { city: "Austin", state: "TX" },
  seattle: { city: "Seattle", state: "WA" },
  "new york": { city: "New York", state: "NY" },
  nyc: { city: "New York", state: "NY" },
  manhattan: { city: "New York", state: "NY" },
};

export function normalizeQuery(query: string): { city: string; state: string } {
  const lower = query.toLowerCase().trim();

  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];

  for (const [keyword, value] of Object.entries(CITY_KEYWORDS)) {
    if (lower.includes(keyword)) return value;
  }

  return { city: query.trim(), state: "" };
}

// ─── Adapt FastAPI response → SearchProperty ─────────────────────────────────

function adaptProperty(p: PropertyListItem): SearchProperty {
  return {
    id: p.id,
    address: p.address_display ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    price: p.list_price ?? 0,
    beds: p.beds ?? 0,
    baths: p.baths ?? 0,
    sqft: p.sqft ?? 0,
    photoUrl: p.photo_url ?? "",
    overallScore: p.agg_data?.scores?.overall ?? 5.0,
    lastUpdated: p.last_enriched ?? new Date().toISOString(),
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 10;

  if (!q.trim()) {
    return NextResponse.json(
      { properties: [], total: 0, page: 1, pageSize },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const { city, state } = normalizeQuery(q);

  // Try FastAPI backend (Redfin real data), fall back to empty on failure
  let properties: SearchProperty[] = [];
  try {
    const results = await searchProperties({
      city,
      state: state || undefined,
      limit: 50,
    });
    properties = results.map(adaptProperty);
  } catch (err) {
    // Backend unavailable — return empty rather than fake data
    console.error("Search backend error:", err);
  }

  const total = properties.length;
  const start = (page - 1) * pageSize;
  const paginatedProperties = properties.slice(start, start + pageSize);

  return NextResponse.json(
    { properties: paginatedProperties, total, page, pageSize },
    { headers: { "Cache-Control": "no-store" } }
  );
}
