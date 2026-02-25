"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { searchProperties, type PropertyListItem } from "@/lib/api";
import { GitCompareArrows } from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

function ListingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const city = searchParams.get("city") ?? "";
  const beds = searchParams.get("beds") ?? "";
  const maxPrice = searchParams.get("max_price") ?? "";

  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [view, setView] = useState<"grid" | "map">("grid");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const searchParams = {
      city: city || undefined,
      beds: beds ? Number(beds) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    };
    searchProperties(searchParams)
      .then((props) => {
        setProperties(props);
        // Re-fetch once after 8s to pick up photos loaded by background tasks
        const t = setTimeout(() => {
          searchProperties(searchParams).then(setProperties).catch(() => {});
        }, 8000);
        return () => clearTimeout(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [city, beds, maxPrice]);

  const toggleCompare = useCallback((id: number) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4)
    );
  }, []);

  const goCompare = () => {
    if (compareIds.length >= 2) {
      router.push(`/compare?ids=${compareIds.join(",")}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <a href="/" className="font-black text-xl shrink-0">
            Spec<span className="text-primary">House</span>
          </a>
          <div className="flex-1 min-w-0">
            <SearchBar defaultCity={city} defaultBeds={beds} defaultMaxPrice={maxPrice} />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant={view === "grid" ? "default" : "outline"}
              onClick={() => setView("grid")}
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={view === "map" ? "default" : "outline"}
              onClick={() => setView("map")}
            >
              Map
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 flex-1">
        {/* Result count */}
        <div className="mb-4 text-sm text-muted-foreground">
          {loading ? "Searching…" : error ? null : `${properties.length} properties found in ${city}`}
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

      {/* Floating compare tray */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-background border rounded-full shadow-xl px-5 py-3">
          <span className="text-sm font-medium">
            {compareIds.length} selected
          </span>
          <Button size="sm" onClick={goCompare} disabled={compareIds.length < 2}>
            <GitCompareArrows className="w-4 h-4 mr-1" />
            Compare
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>
            Clear
          </Button>
        </div>
      )}
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
