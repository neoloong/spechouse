"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { compareProperties, compareByExternalIds, type PropertySpec } from "@/lib/api";
import CompareTable from "@/components/CompareTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Check, MessageSquare } from "lucide-react";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";
import LeadForm from "@/components/LeadForm";

// ── Best-in-category computation ─────────────────────────────────────────────

type CellValue = string | number | null | undefined;

function bestIdx(values: CellValue[], higherIsBetter: boolean | undefined): number {
  if (higherIsBetter === undefined) return -1;
  const nums = values.filter((v) => typeof v === "number" && v != null) as number[];
  if (nums.length < 2) return -1;
  const target = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  const idx = values.indexOf(target);
  return idx >= 0 ? idx : -1;
}

function sectionBestProp(
  properties: PropertySpec[],
  row: { key?: keyof PropertySpec; higherIsBetter?: boolean; renderCell?: (p: PropertySpec) => React.ReactNode }
): number {
  if (!row.key && !row.renderCell) return -1;
  if (row.renderCell) return -1; // text-only rows, no winner
  const vals = properties.map((p) => p[row.key!] as CellValue);
  return bestIdx(vals, row.higherIsBetter);
}

interface SectionBannerProps {
  title: string;
  label: string;
  address: string;
  badge?: string;
}

function SectionBanner({ title, label, address, badge }: SectionBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 mb-4">
      <span className="text-lg">🏆</span>
      <span className="text-sm font-medium text-emerald-800">
        Best {label}:{" "}
        <span className="font-semibold">{address.split(",")[0]}</span>
        {badge && <span className="ml-1 text-xs text-emerald-600">({badge})</span>}
      </span>
    </div>
  );
}

// ── LeadForm inline state ──────────────────────────────────────────────────────

function LeadFormToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-primary/70" />
      <p className="text-sm font-medium mb-1">Want an agent to review this comparison?</p>
      <p className="text-xs text-muted-foreground mb-4">
        Get a professional breakdown — free, no commitment.
      </p>
      <Button size="sm" onClick={onToggle}>
        Request Agent Review
      </Button>
    </div>
  );
}

// ── Main content component ─────────────────────────────────────────────────────

export function CompareClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const eidsParam = searchParams.get("eids") ?? "";
  const backUrl = searchParams.get("from") ?? "/listings";

  const [specs, setSpecs] = useState<PropertySpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  // Set data-authenticated on body for CSS targeting
  useEffect(() => {
    const authToken = localStorage.getItem("auth_token");
    document.body.setAttribute(
      "data-authenticated",
      authToken ? "true" : "false"
    );
    return () => document.body.removeAttribute("data-authenticated");
  }, []);

  const handleShare = () => {
    const eids = specs.map((s) => s.external_id).filter(Boolean).join(",");
    const shareUrl = eids
      ? `${window.location.origin}/compare?eids=${encodeURIComponent(eids)}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      trackEvent(AnalyticsEvents.COMPARE_SHARE, {
        property_ids: eids,
        property_count: specs.length,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (eidsParam) {
      const eids = eidsParam.split(",").filter(Boolean);
      if (eids.length < 2) {
        setError("This share link needs at least 2 properties.");
        setLoading(false);
        return;
      }
      if (eids.length > 4) {
        setError("Compare supports at most 4 properties at a time.");
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
      if (ids.length > 4) {
        setError("Compare supports at most 4 properties at a time.");
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

  const handlePrint = () => {
    trackEvent(AnalyticsEvents.PDF_EXPORT, {
      property_ids: specs.map((s) => s.id).join(","),
    });
    window.print();
  };

  // ── Best-in-category banners ──────────────────────────────────────────────

  const banners: SectionBannerProps[] = [];

  const sectionDefs = [
    {
      title: "Financials",
      rows: [
        { key: "list_price" as keyof PropertySpec, higherIsBetter: false },
        { key: "rental_yield_pct" as keyof PropertySpec, higherIsBetter: true },
        { key: "cap_rate" as keyof PropertySpec, higherIsBetter: true },
      ],
    },
    {
      title: "Value",
      rows: [
        { key: "score_value" as keyof PropertySpec, higherIsBetter: true },
        { key: "price_per_sqft" as keyof PropertySpec, higherIsBetter: false },
      ],
    },
    {
      title: "Investment",
      rows: [
        { key: "score_investment" as keyof PropertySpec, higherIsBetter: true },
      ],
    },
    {
      title: "Overall",
      rows: [
        { key: "score_overall" as keyof PropertySpec, higherIsBetter: true },
      ],
    },
  ];

  for (const { title, rows } of sectionDefs) {
    // Find the first row where there's a clear winner (all values differ)
    for (const row of rows) {
      if (!row.key) continue;
      const vals = specs.map((p) => p[row.key!] as CellValue);
      const nums = vals.filter((v) => typeof v === "number" && v != null);
      if (nums.length < specs.length) continue; // need all to have values
      const same = nums.every((n) => n === nums[0]);
      if (same) continue;
      const winIdx = bestIdx(vals, row.higherIsBetter);
      if (winIdx >= 0) {
        const prop = specs[winIdx];
        const raw = prop[row.key!] as number;
        let badge: string | undefined;
        if (row.key === "list_price") badge = `$${raw.toLocaleString()}`;
        else if (row.key === "score_value" || row.key === "score_investment" || row.key === "score_overall")
          badge = `${raw}/10`;
        else if (row.key === "rental_yield_pct" || row.key === "cap_rate") badge = `${raw.toFixed(1)}%`;
        else if (row.key === "price_per_sqft") badge = `$${raw}/sqft`;
        banners.push({ title, label: row.key!.replace(/_/g, " ").replace(/score_/i, "Score "), address: prop.address_display, badge });
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10 no-print">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-black text-lg shrink-0 no-print">
            Spec<span className="text-primary">House</span>
          </Link>
          <Link href={backUrl} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 no-print">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to results
          </Link>
          <h1 className="text-base font-semibold ml-2">Compare</h1>
          {specs.length >= 2 && (
            <>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint} className="no-print">
                  Export PDF
                </Button>
                <Button size="sm" variant="outline" onClick={handleShare} className="no-print">
                  {copied ? (
                    <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-1.5" />
                  )}
                  {copied ? "Copied!" : "Share"}
                </Button>
              </div>
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

        {/* Best-in-category banners */}
        {!loading && !error && specs.length >= 2 && (
          <>
            <div className="space-y-2 mb-6">
              {banners.map((b) => (
                <SectionBanner key={b.label} {...b} />
              ))}
            </div>
            <CompareTable properties={specs} />

            {/* Lead form trigger */}
            {!showLeadForm ? (
              <LeadFormToggle onToggle={() => setShowLeadForm(true)} />
            ) : (
              <div className="mt-6">
                <LeadForm
                  context="compare"
                  propertyIds={specs.map((s) => s.id)}
                  onClose={() => setShowLeadForm(false)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper (client) ───────────────────────────────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <CompareClient />
    </Suspense>
  );
}