"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import PropertyCard from "@/components/PropertyCard";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { searchProperties, type PropertyListItem } from "@/lib/api";
import { useCompare } from "@/hooks/useCompare";
import { Sparkles, X } from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

function ListingsContent() {
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

  const { ids: compareIds, toggle: toggleCompare } = useCompare();

  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [view, setView]             = useState<"grid" | "map">("grid");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {
      city:         city || undefined,
      state:        stateCode || undefined,
      zip_code:     zipCode || undefined,
      beds:         bedsParam ? Number(bedsParam) : undefined,
      min_baths:    minBathsParam ? Number(minBathsParam) : undefined,
      min_price:    minPriceParam ? Number(minPriceParam) : undefined,
      max_price:    maxPriceParam ? Number(maxPriceParam) : undefined,
      property_type: propertyType || undefined,
      min_sqft:     minSqftParam ? Number(minSqftParam) : undefined,
    };
    searchProperties(params)
      .then((props) => {
        setProperties(props);
        const t = setTimeout(() => {
          searchProperties(params).then(setProperties).catch(() => {});
        }, 8000);
        return () => clearTimeout(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, zipCode, stateCode, bedsParam, minBathsParam, minPriceParam, maxPriceParam, propertyType, minSqftParam]);

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


  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ── */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <a href="/" className="font-black text-xl shrink-0">
            Spec<span className="text-primary">House</span>
          </a>
          <div className="flex-1 min-w-0">
            <SearchBar defaultCity={zipCode || city} defaultBeds={bedsParam} defaultMaxPrice={maxPriceParam} />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>
              Grid
            </Button>
            <Button size="sm" variant={view === "map"  ? "default" : "outline"} onClick={() => setView("map")}>
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
        <div className="mb-4 text-sm text-muted-foreground">
          {loading
            ? "Searching…"
            : error
              ? null
              : `${properties.length} properties found${searchLabel ? ` in ${searchLabel}` : ""}`
          }
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-4">
            {error} — make sure the backend is running and your API key is configured.
          </div>
        )}

        {view === "map" ? (
          <div className="h-[70vh]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <MapView properties={properties} onMarkerClick={(id) => router.push(`/property/${id}`)} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))
              : properties.map((p) => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    compareIds={compareIds}
                    onToggleCompare={toggleCompare}
                  />
                ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <ListingsContent />
    </Suspense>
  );
}
