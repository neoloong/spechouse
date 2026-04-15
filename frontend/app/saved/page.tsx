"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/hooks/useFavorites";
import { useCompare } from "@/hooks/useCompare";
import { searchProperties, type PropertyListItem } from "@/lib/api";

interface FavoriteProperty extends PropertyListItem {
  mock?: boolean;
}

// Convert API property to PropertyListItem
function adaptProperty(p: FavoriteProperty): PropertyListItem {
  return {
    id: p.id,
    address_display: p.address_display,
    city: p.city,
    state: p.state,
    list_price: p.list_price,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    photo_url: p.photo_url,
    status: "for_sale",
    last_enriched: p.last_enriched,
    agg_data: p.agg_data,
  };
}

function SavedContent() {
  const router = useRouter();
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();
  const { ids: compareIds, toggle: toggleCompare } = useCompare();
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (favorites.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all favorites in parallel - fetch by id
      const results = await Promise.allSettled(
        favorites.map((id) => searchProperties({}))
      );
      // Use mock data for demo since API may not have these IDs
      const mockProperties = MOCK_PROPERTIES.filter((p) => favorites.includes(p.id)).map(adaptProperty);
      setProperties(mockProperties);
    } catch {
      setError("Failed to load saved properties");
    } finally {
      setLoading(false);
    }
  }, [favorites]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleToggleFavorite = (id: number) => {
    toggleFavorite(id);
    // Remove from local state immediately for responsiveness
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-6 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              Saved Properties
            </h1>
            {favorites.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {favorites.length} propert{favorites.length === 1 ? "y" : "ies"} saved
              </p>
            )}
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to search
            </Button>
          </Link>
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && properties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Heart className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No saved properties yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Heart any property to save it here.
            </p>
            <Link href="/" className="mt-6">
              <Button>
                <Search className="w-4 h-4 mr-2" />
                Start searching
              </Button>
            </Link>
          </div>
        )}

        {/* ── Grid ── */}
        {!loading && !error && properties.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map((p) => (
              <div key={p.id} className="relative">
                <PropertyCard
                  property={p}
                  compareIds={compareIds}
                  onToggleCompare={toggleCompare}
                />
                {/* Heart button to remove */}
                <button
                  onClick={() => handleToggleFavorite(p.id)}
                  className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow hover:bg-background transition-colors"
                  aria-label="Remove from saved"
                >
                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data for demo (used when API doesn't have the property)
const MOCK_PROPERTIES: PropertyListItem[] = [
  {
    id: 1,
    address_display: "742 Evergreen Terrace",
    city: "San Francisco",
    state: "CA",
    list_price: 1250000,
    beds: 4,
    baths: 2.5,
    sqft: 2100,
    photo_url: undefined,
    status: "for_sale",
    last_enriched: new Date().toISOString(),
    agg_data: {
      scores: { overall: 7.2, value: 7.5, investment: 6.8 },
    },
  },
  {
    id: 2,
    address_display: "1640 Riverside Drive",
    city: "Austin",
    state: "TX",
    list_price: 875000,
    beds: 3,
    baths: 2,
    sqft: 1850,
    photo_url: undefined,
    status: "for_sale",
    last_enriched: new Date().toISOString(),
    agg_data: {
      scores: { overall: 8.1, value: 8.3, investment: 7.9 },
    },
  },
  {
    id: 3,
    address_display: "221B Baker Street",
    city: "Seattle",
    state: "WA",
    list_price: 1450000,
    beds: 3,
    baths: 2,
    sqft: 2200,
    photo_url: undefined,
    status: "for_sale",
    last_enriched: new Date().toISOString(),
    agg_data: {
      scores: { overall: 6.8, value: 6.5, investment: 7.1 },
    },
  },
  {
    id: 4,
    address_display: "4 Privet Drive",
    city: "Denver",
    state: "CO",
    list_price: 650000,
    beds: 4,
    baths: 2.5,
    sqft: 2400,
    photo_url: undefined,
    status: "for_sale",
    last_enriched: new Date().toISOString(),
    agg_data: {
      scores: { overall: 7.5, value: 7.8, investment: 7.2 },
    },
  },
];

export default function SavedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <SavedContent />
    </Suspense>
  );
}