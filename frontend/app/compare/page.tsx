"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { compareProperties, compareByExternalIds, type PropertySpec } from "@/lib/api";
import CompareTable from "@/components/CompareTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Check } from "lucide-react";

function CompareContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const eidsParam = searchParams.get("eids") ?? "";
  const backUrl = searchParams.get("from") ?? "/listings";

  const [specs, setSpecs] = useState<PropertySpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    // Build a shareable URL using external_ids so it works on any device/server
    const eids = specs.map((s) => s.external_id).filter(Boolean).join(",");
    const shareUrl = eids
      ? `${window.location.origin}/compare?eids=${encodeURIComponent(eids)}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (eidsParam) {
      // Shareable link via external_ids
      const eids = eidsParam.split(",").filter(Boolean);
      if (eids.length < 2) {
        setError("This share link needs at least 2 properties.");
        setLoading(false);
        return;
      }
      compareByExternalIds(eids)
        .then((data) => setSpecs(data.properties))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (idsParam) {
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
    } else {
      setLoading(false);
    }
  }, [idsParam, eidsParam]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-black text-lg shrink-0">
            Spec<span className="text-primary">House</span>
          </Link>
          <Link href={backUrl} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to results
          </Link>
          <h1 className="text-base font-semibold ml-2">Compare</h1>
          {specs.length >= 2 && (
            <>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="ml-auto">
                Export PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleShare} className="ml-2">
                {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Share2 className="w-4 h-4 mr-1.5" />}
                {copied ? "Copied!" : "Share"}
              </Button>
            </>
          )}
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
