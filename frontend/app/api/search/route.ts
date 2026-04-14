import { NextRequest, NextResponse } from "next/server";

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

  // Exact alias match
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];

  // Keyword partial match
  for (const [keyword, value] of Object.entries(CITY_KEYWORDS)) {
    if (lower.includes(keyword)) return value;
  }

  // Default: treat whole query as city name
  return { city: query.trim(), state: "" };
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_PROPERTIES: Record<string, SearchProperty[]> = {
  "San Francisco": [
    {
      id: 1,
      address: "123 Market St, San Francisco, CA 94103",
      city: "San Francisco",
      state: "CA",
      price: 1250000,
      beds: 2,
      baths: 2,
      sqft: 1100,
      photoUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop",
      overallScore: 8.2,
      lastUpdated: "2026-04-12T10:30:00Z",
    },
    {
      id: 2,
      address: "456 Valencia St, San Francisco, CA 94110",
      city: "San Francisco",
      state: "CA",
      price: 985000,
      beds: 1,
      baths: 1,
      sqft: 750,
      photoUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=300&fit=crop",
      overallScore: 7.5,
      lastUpdated: "2026-04-11T14:20:00Z",
    },
    {
      id: 3,
      address: "789 Howard St, San Francisco, CA 94103",
      city: "San Francisco",
      state: "CA",
      price: 2100000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      photoUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop",
      overallScore: 9.1,
      lastUpdated: "2026-04-10T09:15:00Z",
    },
  ],
  Austin: [
    {
      id: 10,
      address: "200 Congress Ave, Austin, TX 78701",
      city: "Austin",
      state: "TX",
      price: 450000,
      beds: 2,
      baths: 2,
      sqft: 1200,
      photoUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop",
      overallScore: 7.8,
      lastUpdated: "2026-04-13T11:00:00Z",
    },
    {
      id: 11,
      address: "301 E 6th St, Austin, TX 78701",
      city: "Austin",
      state: "TX",
      price: 375000,
      beds: 1,
      baths: 1,
      sqft: 680,
      photoUrl: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=400&h=300&fit=crop",
      overallScore: 6.9,
      lastUpdated: "2026-04-12T08:45:00Z",
    },
  ],
  Seattle: [
    {
      id: 20,
      address: "1501 4th Ave, Seattle, WA 98101",
      city: "Seattle",
      state: "WA",
      price: 875000,
      beds: 2,
      baths: 2,
      sqft: 1050,
      photoUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop",
      overallScore: 8.0,
      lastUpdated: "2026-04-13T16:30:00Z",
    },
    {
      id: 21,
      address: "2200 Alaskan Way, Seattle, WA 98121",
      city: "Seattle",
      state: "WA",
      price: 625000,
      beds: 1,
      baths: 1,
      sqft: 620,
      photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      overallScore: 7.2,
      lastUpdated: "2026-04-11T12:00:00Z",
    },
  ],
  "New York": [
    {
      id: 30,
      address: "350 5th Ave, New York, NY 10118",
      city: "New York",
      state: "NY",
      price: 1850000,
      beds: 2,
      baths: 2,
      sqft: 1400,
      photoUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
      overallScore: 8.7,
      lastUpdated: "2026-04-12T15:00:00Z",
    },
    {
      id: 31,
      address: "100 Fulton St, New York, NY 10038",
      city: "New York",
      state: "NY",
      price: 1295000,
      beds: 1,
      baths: 1,
      sqft: 850,
      photoUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop",
      overallScore: 7.9,
      lastUpdated: "2026-04-10T10:30:00Z",
    },
  ],
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 10;

  // Handle empty query
  if (!q.trim()) {
    return NextResponse.json(
      { properties: [], total: 0, page: 1, pageSize },
      {
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "99",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Normalize the city query
  const { city, state } = normalizeQuery(q);

  // Look up mock data by normalized city
  let properties = MOCK_PROPERTIES[city] ?? [];

  // Filter by state if provided and city matches
  if (state && properties.length > 0) {
    properties = properties.filter((p) => p.state === state);
  }

  const total = properties.length;
  const start = (page - 1) * pageSize;
  const paginatedProperties = properties.slice(start, start + pageSize);

  return NextResponse.json(
    {
      properties: paginatedProperties,
      total,
      page,
      pageSize,
    },
    {
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "Cache-Control": "no-store",
      },
    }
  );
}
