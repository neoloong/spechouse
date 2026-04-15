"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import PropertyCard from "@/components/PropertyCard";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { searchProperties, type PropertyListItem } from "@/lib/api";
import { useCompare } from "@/hooks/useCompare";
import { Sparkles, X, RefreshCw, AlertCircle, Home } from "lucide-react";
import { analytics } from "@/lib/analytics";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchApiProperty {
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

interface SearchApiResult {
  properties: SearchApiProperty[];
  total: number;
  page: number;
  pageSize: number;
}

// Convert API property to PropertyListItem for PropertyCard
function adaptProperty(p: SearchApiProperty): PropertyListItem {
  return {
    id: p.id,
    address_display: p.address,
    city: p.city,
    state: p.state,
    list_price: p.price,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    photo_url: p.photoUrl,
    status: "for_sale",
    last_enriched: p.lastUpdated,
    agg_data: {
      scores: {
        overall: p.overallScore,
      },
    },
  };
}

// ─── Content component ────────────────────────────────────────────────────────

export default function ListingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── URL params ──────────────────────────────────────────────────────────────
  const city        = searchParams.get("city") ?? "";
  const zipCode     = searchParams.get("zip_code") ?? "";
  const stateCode   = searchParams.get("state") ?? "";
  const aiQuery     = searchParams.get("ai_query") ?? "";

  // Filter params from URL
  const bedsParam       = searchParams.get("beds") ?? "";
  const minBathsParam   = searchParams.get("min_baths") ?? "";
  const minPriceParam   = searchParams.get("min_price") ?? "";
  const maxPriceParam   = searchParams.get("max_price") ?? "";
  const propertyType    = searchParams.get("property_type") ?? "";
  const minSqftParam    = searchParams.get("min_sqft") ?? "";

  const searchLabel = zipCode || city;

  // ── Filter state (driven by URL) ─────────────────────────────────────────
  const filterValue: FilterState = {
    propertyType,
    minBeds:  bedsParam     ? Number(bedsParam)     : 0,
    minBaths: minBathsParam ? Number(minBathsParam) : 0,
    minPrice: minPriceParam ? Number(minPriceParam) : 0,
    maxPrice: maxPriceParam ? Number(maxPriceParam) : 0,
    minSqft:  minSqftParam  ? Number(minSqftParam)  : 0,
  };

  const { ids: compareIds, toggle: toggleCompare, cacheProperties } = useCompare();

  const [apiProperties, setApiProperties] = useState<SearchApiProperty[]>([]);
  const [properties, setProperties]       = useState<PropertyListItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [view, setView]                     = useState<"grid" | "map">("grid");

  // ── Fetch from new search API ──────────────────────────────────────────────
  const fetchProperties = useCallback(async () => {
    if (!city && !zipCode) return;

    setLoading(true);
    setError(null);

    try {
      // Build the API URL manually since we're using our own mock API
      const params = new URLSearchParams();
      if (city) params.set("q", city);
      if (zipCode) params.set("q", zipCode);
      params.set("page", "1");

      const res = await fetch(`/api/search?${params.toString()}`, {
        cache: "no-store",
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data: SearchApiResult = await res.json();
      setApiProperties(data.properties);
      setProperties(data.properties.map(adaptProperty));
      cacheProperties(data.properties.map(p => ({
        id: p.id,
        address: p.address,
        price: p.price ?? 0,
        score: p.overallScore,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load properties");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, zipCode]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ── Filter change → URL update ───────────────────────────────────────────
  const handleFilterChange = useCallback((f: FilterState) => {
    const p = new URLSearchParams(searchParams.toString());
    const set = (key: string, val: string | number | undefined) => {
      if (val) p.set(key, String(val)); else p.delete(key);
    };
    set("property_type", f.propertyType || undefined);
    set("beds",          f.minBeds  || undefined);
    set("min_baths",     f.minBaths || undefined);
    set("min_price",     f.minPrice || undefined);
    set("max_price",     f.maxPrice || undefined);
    set("min_sqft",      f.minSqft  || undefined);
    router.replace(`/listings?${p.toString()}`);
  }, [router, searchParams]);

  // ── Result count label ───────────────────────────────────────────────────
  const resultLabel = loading
    ? "Searching…"
    : error
      ? null
      : `${properties.length} property${properties.length !== 1 ? "s" : ""} in ${searchLabel}`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ── */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Link href="/" className="font-black text-xl shrink-0">
            Spec<span className="text-primary">House</span>
          </Link>
          <div className="flex-1 min-w-0">
            <SearchBar defaultCity={zipCode || city} defaultBeds={bedsParam} defaultMaxPrice={maxPriceParam} />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>
              Grid
            </Button>
            <Button size="sm" variant={view === "map" ? "default" : "outline"} onClick={() => setView("map")}>
              Map
            </Button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="container mx-auto px-4 pb-3 overflow-x-auto">
          <FilterBar value={filterValue} onChange={handleFilterChange} />
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 flex-1">
        {/* AI query badge */}
        {aiQuery && (
          <div className="flex items-center gap-2 mb-4 text-sm bg-primary/5 border border-primary/20 rounded-full px-3 py-1.5 w-fit">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-primary font-medium">AI: {aiQuery}</span>
            <button
              onClick={() => {
                const p = new URLSearchParams(searchParams.toString());
                p.delete("ai_query");
                router.replace(`/listings?${p.toString()}`);
              }}
              className="text-muted-foreground hover:text-foreground ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Result count */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {resultLabel}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchProperties}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-destructive font-medium">Failed to load properties</p>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchProperties} className="shrink-0">
              Try again
            </Button>
          </div>
        )}

        {/* ── Map view ── */}
        {view === "map" ? (
          <div className="h-[70vh]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <MapView
                properties={properties}
                onMarkerClick={(id) => router.push(`/property/${id}`)}
              />
            )}
          </div>
        ) : (
          <>
            {/* ── Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
                  ))
                : properties.length > 0
                  ? properties.map((p) => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        compareIds={compareIds}
                        onToggleCompare={toggleCompare}
                      />
                    ))
                  : null}
            </div>

            {/* ── Empty state ── */}
            {!loading && !error && properties.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Home className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  No results for {searchLabel || "this search"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Try a nearby city or broaden your filters to see more properties.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                    Go home
                  </Button>
                  <Button size="sm" onClick={() => router.push("/listings")}>
                    Browse all
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}