/**
 * Typed API client — talks to the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface PropertyListItem {
  id: number;
  external_id?: string;
  address_display: string;
  city?: string;
  state?: string;
  zip_code?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  list_price?: number;
  property_type?: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  photos?: string[];
  agg_data: AggData;
  status?: string;
  last_enriched?: string;
}

export interface PropertyDetail extends PropertyListItem {
  lot_sqft?: number;
  year_built?: number;
  hoa_fee?: number;
  property_tax?: number;
  last_enriched?: string;
  created_at?: string;
}

export interface SchoolEntry {
  name: string;
  type: string;
  distance_mi?: number;
  level?: string | null;
}

export interface AggData {
  rental?: {
    estimate?: number;
    yield_pct?: number;
    cap_rate?: number;
    source?: string;
    zillow_city_median?: number;  // Zillow Q1 2025 city median for this bedroom count
  };
  environment?: {
    noise_db?: number;
    noise_label?: string;
    noise_score?: number;
    noise_detail?: { traffic?: number; local?: number; airports?: number };
    crime_score?: number;
    crime_label?: string;
  };
  scores?: {
    overall?: number;
    value?: number;
    investment?: number;
    environment?: number;
  };
  schools?: SchoolEntry[];
  comparisons?: Record<string, unknown>;
  crime?: {
    safety_score?: number;
    label?: string;
    violent_count?: number;
    total_count?: number;
    radius_miles?: number;
    period_days?: number;
    source?: string;
  };
  lifestyle?: Record<string, { score: number; label: string; description: string }>;
}

export interface PropertySpec {
  id: number;
  external_id?: string;
  address_display: string;
  photo_url?: string;
  photos?: string[];
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  // Status
  status?: string;
  list_price?: number;
  price_per_sqft?: number;
  rental_estimate?: number;
  rental_yield_pct?: number;
  cap_rate?: number;
  zillow_city_median?: number;
  // Specs
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_sqft?: number;
  year_built?: number;
  property_type?: string;
  hoa_fee?: number;
  property_tax?: number;
  agg_data?: AggData;
  parking?: string;
  // Financials (detail page)
  avm_estimate?: number;
  price_change_pct?: number;
  last_sold_date?: string;
  last_sold_price?: number;
  price_history?: { date: string; price: number; event: string }[];
  days_on_market?: number;
  // Environment
  noise_db?: number;
  noise_score?: number;        // computed 0-100 quietness score (higher = quieter)
  noise_label?: string;
  noise_detail?: {
    traffic?: number;
    local?: number;
    airports?: number;
  };
  crime_score?: number;
  crime_label?: string;
  crime_safety_score?: number;
  walkability_score?: number;
  // Lifestyle scores
  lifestyle_walk_score?: number;
  lifestyle_transit_score?: number;
  lifestyle_bike_score?: number;
  // Scores
  score_overall?: number;
  score_value?: number;
  score_investment?: number;
  score_environment?: number;
  score_confidence?: number;
  // Schools
  schools?: { name: string; type: string; rating: number; distance_mi: number }[];
  school_elementary?: string;
  school_middle?: string;
  school_high?: string;
  schools_count?: number;
  nearest_school?: string;
}

export interface CompareResponse {
  properties: PropertySpec[];
}

export interface SearchParams {
  city?: string;
  state?: string;
  zip_code?: string;
  beds?: number;
  min_baths?: number;
  min_price?: number;
  max_price?: number;
  property_type?: string;
  min_sqft?: number;
  max_sqft?: number;
  limit?: number;
}

export interface ParsedSearch {
  city?: string;
  state?: string;
  beds?: number;
  baths?: number;
  min_price?: number;
  max_price?: number;
  property_type?: string;
  min_sqft?: number;
  parsed_summary?: string;
}

async function fetchJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { cache: "no-store", headers: { "ngrok-skip-browser-warning": "true" } });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function searchProperties(params: SearchParams): Promise<PropertyListItem[]> {
  return fetchJson<PropertyListItem[]>("/properties/search", params as Record<string, string | number | undefined>);
}

export async function getProperty(id: number): Promise<PropertyDetail> {
  return fetchJson<PropertyDetail>(`/properties/${id}`);
}

// ─── Mock data for demo / development ─────────────────────────────────────────

function mockPropertyDetail(id: string): PropertySpec {
  return {
    id: Number(id),
    address_display: "742 Geary St, San Francisco, CA 94109",
    city: "San Francisco",
    state: "CA",
    zip_code: "94109",
    latitude: 37.7849,
    longitude: -122.4194,
    status: "for_sale",
    list_price: 1_295_000,
    price_per_sqft: 870,
    beds: 3,
    baths: 2,
    sqft: 1488,
    lot_sqft: 2_613,
    year_built: 1908,
    property_type: "Single Family",
    hoa_fee: 0,
    property_tax: 14_800,
    parking: "1-car garage",
    photo_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
    photos: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ],
    // Scores
    score_overall: 7.4,
    score_value: 7.8,
    score_investment: 6.9,
    score_environment: 7.5,
    score_confidence: 0.82,
    // Financials
    avm_estimate: 1_340_000,
    price_change_pct: -3.4,
    last_sold_date: "2019-03-15",
    last_sold_price: 1_100_000,
    price_history: [
      { date: "2025-03-01", price: 1_340_000, event: "Listed" },
      { date: "2025-01-15", price: 1_295_000, event: "Price change" },
      { date: "2024-11-20", price: 1_375_000, event: "Listed" },
    ],
    days_on_market: 42,
    // Environment
    noise_db: 45,
    noise_score: 7.2,
    noise_label: "Quiet",
    noise_detail: { traffic: 42.5, local: 38.1, airports: 0.0 },
    crime_safety_score: 78,
    crime_label: "Low",
    walkability_score: 92,
    // Lifestyle
    lifestyle_walk_score: 92,
    lifestyle_transit_score: 85,
    lifestyle_bike_score: 74,
    // Schools
    schools: [
      { name: "Rosa Parks Elementary", type: "elementary", rating: 8, distance_mi: 0.4 },
      { name: "Everett Middle School", type: "middle", rating: 7, distance_mi: 0.7 },
      { name: "Wallenberg High School", type: "high", rating: 7, distance_mi: 1.1 },
    ],
  };
}

/**
 * Fetch a single property by ID.
 * Uses the real backend API when NEXT_PUBLIC_API_URL is set;
 * falls back to rich mock data for local development / demos.
 */
export async function getPropertyDetail(id: string): Promise<PropertySpec | null> {
  // Try real API first
  try {
    const property = await getProperty(Number(id));
    // Adapt PropertyDetail → PropertySpec (some fields may be missing)
    return property as unknown as PropertySpec;
  } catch {
    // Fall back to mock for demo
    if (process.env.NEXT_PUBLIC_API_URL) return null; // real URL set — don't fake it
    return mockPropertyDetail(id);
  }
}

export async function compareProperties(ids: number[]): Promise<CompareResponse> {
  return fetchJson<CompareResponse>("/compare", { ids: ids.join(",") });
}

export async function compareByExternalIds(eids: string[]): Promise<CompareResponse> {
  return fetchJson<CompareResponse>("/compare", { eids: eids.join(",") });
}

export async function parseSearch(q: string): Promise<ParsedSearch> {
  return fetchJson<ParsedSearch>("/search/parse", { q });
}

export function fmt(n: number | undefined | null, style: "currency" | "decimal" | "percent" = "decimal", decimals = 0): string {
  if (n == null || n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style,
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function scoreColor(score: number | undefined): string {
  if (score == null) return "bg-muted text-muted-foreground";
  // Score is now on 0-10 scale
  if (score >= 7) return "bg-emerald-100 text-emerald-800";
  if (score >= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}
