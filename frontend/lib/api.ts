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
  };
  environment?: {
    noise_db?: number;
    noise_label?: string;
    crime_score?: number;
  };
  scores?: {
    overall?: number;
    value?: number;
    investment?: number;
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
  // Specs
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_sqft?: number;
  year_built?: number;
  property_type?: string;
  hoa_fee?: number;
  property_tax?: number;
  // Environment
  noise_db?: number;
  noise_score?: number;
  noise_label?: string;
  crime_score?: number;
  crime_label?: string;
  // Schools
  school_elementary?: string;
  school_middle?: string;
  school_high?: string;
  // Scores
  score_overall?: number;
  score_value?: number;
  score_investment?: number;
  // Schools
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
  const res = await fetch(url.toString(), { next: { revalidate: 60 }, headers: { "ngrok-skip-browser-warning": "true" } });
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
