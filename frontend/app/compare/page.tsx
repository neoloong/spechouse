"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { compareProperties, type PropertySpec } from "@/lib/api";
import CompareTable from "@/components/CompareTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function CompareContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";

  const [specs, setSpecs] = useState<PropertySpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idsParam) {
      setLoading(false);
      return;
    }
    const ids = idsParam.split(",").map(Number).filter(Boolean);
    if (ids.length < 2) {
      setError("Select at least 2 properties to compare.");
      setLoading(false);
      return;
    }
    compareProperties(ids)
      .then((data) => setSpecs(data.properties))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [idsParam]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-black text-lg shrink-0">
            Spec<span className="text-primary">House</span>
          </Link>
          <Link href="/listings" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to results
          </Link>
          <h1 className="text-base font-semibold ml-2">Compare</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Link href="/listings">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Browse properties
              </Button>
            </Link>
          </div>
        )}

        {!loading && !error && specs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No properties selected for comparison.</p>
            <Link href="/listings">
              <Button variant="outline">Browse properties</Button>
            </Link>
          </div>
        )}

        {!loading && specs.length >= 2 && <CompareTable properties={specs} />}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <CompareContent />
    </Suspense>
  );
}
