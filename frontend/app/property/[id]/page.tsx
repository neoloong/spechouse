import { getPropertyDetail, fmt, scoreColor, type PropertySpec } from "@/lib/api";
import ScoreBadge from "@/components/ScoreBadge";
import BackButton from "@/components/BackButton";
import AddToCompareButton from "@/components/AddToCompareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Share2, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const property = await getPropertyDetail(id);
    if (!property) return { title: "Property Not Found" };
    const title = `${property.address_display} – ${property.list_price ? fmt(property.list_price, "currency") : "For Sale"} | SpecHouse`;
    const description = `${property.beds} bed ${property.baths} bath ${property.sqft?.toLocaleString()} sqft ${property.property_type ?? "home"} in ${property.city}, ${property.state}. Compare prices, schools, noise & crime on SpecHouse.`;
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
    };
  } catch {
    return { title: "Property Not Found" };
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function DetailRow({ label, value }: RowProps) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-6 ${className}`}>
      <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="rounded-xl border bg-card px-4">{children}</div>
    </section>
  );
}

// Score bar with fill percentage
function ScoreBar({ score, label, weight }: { score: number; label: string; weight: number }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background:
              score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444",
          }}
        />
      </div>
      <div className="w-8 text-sm font-medium text-right shrink-0">{score.toFixed(1)}</div>
      <div className="w-10 text-xs text-muted-foreground text-right shrink-0">{weight}%</div>
    </div>
  );
}

function ScoreBreakdownTooltip({ type }: { type: "value" | "investment" | "environment" }) {
  const content = {
    value: {
      title: "Value Score",
      description:
        "Based on list price vs. AVM (automated valuation model), price-per-sqft vs. neighborhood median, and days-on-market trends. Higher = undervalued.",
    },
    investment: {
      title: "Investment Score",
      description:
        "Based on estimated rental income, cap rate, gross yield, and price appreciation potential. Factors in local rental market data.",
    },
    environment: {
      title: "Environment Score",
      description:
        "Combines noise levels, crime safety, walkability, and transit accessibility. Higher = better quality of life indicators.",
    },
  };

  const { title, description } = content[type];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground transition-colors cursor-help">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Score weights: Value 40% · Investment 35% · Environment 25%
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PhotoGallery({ photos, address }: { photos?: string[]; address: string }) {
  const [active, setActive] = React.useState(0);
  if (!photos || photos.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl overflow-hidden">
      <div className="relative aspect-[16/9] bg-muted">
        <Image
          src={photos[active]}
          alt={`${address} – photo ${active + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setActive((p) => (p - 1 + photos.length) % photos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={() => setActive((p) => (p + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Next photo"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === active ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Need React for useState in PhotoGallery
import React from "react";

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let property: PropertySpec | null;
  try {
    property = await getPropertyDetail(id);
  } catch {
    property = null;
  }

  if (!property) notFound();

  const {
    address_display: address,
    city,
    state,
    zip_code,
    list_price,
    beds,
    baths,
    sqft,
    lot_sqft,
    year_built,
    property_type,
    hoa_fee,
    property_tax,
    parking,
    photos,
    score_overall,
    score_value,
    score_investment,
    score_environment,
    score_confidence,
    avm_estimate,
    price_change_pct,
    last_sold_date,
    last_sold_price,
    price_history,
    days_on_market,
    noise_db,
    noise_label,
    crime_safety_score,
    crime_label,
    walkability_score,
    lifestyle_walk_score,
    lifestyle_transit_score,
    lifestyle_bike_score,
    schools,
  } = property;

  const monthlyMortgage =
    list_price != null ? Math.round(list_price * 0.0035) : null;
  const avmDiscount =
    list_price != null && avm_estimate != null
      ? ((list_price - avm_estimate) / avm_estimate) * 100
      : null;

  const noiseBucket =
    noise_db != null
      ? noise_db < 50
        ? "Quiet"
        : noise_db < 65
        ? "Moderate"
        : "Loud"
      : null;

  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "pending"
      ? "Pending"
      : property.status === "for_rent"
      ? "For Rent"
      : "For Sale";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky nav */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-black text-lg shrink-0">
            Spec<span className="text-primary">House</span>
          </Link>
          <div className="flex-1" />
          <BackButton />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Photo gallery */}
        <PhotoGallery photos={photos} address={address} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <h1 className="text-2xl font-bold flex-1 min-w-0">{address}</h1>
            <ScoreBadge score={score_overall} label="/10" />
          </div>
          <p className="text-muted-foreground mb-3 text-sm">
            {[city, state, zip_code].filter(Boolean).join(", ")}
            {property_type && (
              <Badge variant="outline" className="ml-2 text-xs">
                {property_type}
              </Badge>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-3xl font-black">{fmt(list_price, "currency")}</p>
            <Badge
              variant={property.status === "sold" ? "destructive" : "default"}
              className="bg-green-600"
            >
              {statusLabel}
            </Badge>
            <AddToCompareButton propertyId={property.id} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 mr-1" />
              Share
            </Button>
          </div>
          {/* Quick stats row */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {beds != null && <span>{beds} bd</span>}
            {baths != null && <span>{baths} ba</span>}
            {sqft != null && <span>{sqft.toLocaleString()} sqft</span>}
            {days_on_market != null && (
              <span className="text-orange-600 font-medium">
                {days_on_market} days on market
              </span>
            )}
          </div>
        </div>

        {/* Score breakdown */}
        <SectionCard title="Score Breakdown">
          <div className="py-2 space-y-3">
            {score_value != null && (
              <div className="flex items-center gap-2">
                <ScoreBar score={score_value} label="Value" weight={40} />
                <ScoreBreakdownTooltip type="value" />
              </div>
            )}
            {score_investment != null && (
              <div className="flex items-center gap-2">
                <ScoreBar score={score_investment} label="Investment" weight={35} />
                <ScoreBreakdownTooltip type="investment" />
              </div>
            )}
            {score_environment != null && (
              <div className="flex items-center gap-2">
                <ScoreBar score={score_environment} label="Environment" weight={25} />
                <ScoreBreakdownTooltip type="environment" />
              </div>
            )}
          </div>
          {score_confidence != null && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Confidence interval: ±{(score_confidence * 2).toFixed(1)} range ·{" "}
              {Math.round(score_confidence * 100)}% data coverage
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Weighted overall: (Value × 40%) + (Investment × 35%) + (Environment × 25%)
          </p>
        </SectionCard>

        {/* Financials */}
        <SectionCard title="Financials">
          <DetailRow label="List Price" value={fmt(list_price, "currency")} />
          {avm_estimate != null && (
            <DetailRow
              label="AVM Estimate"
              value={
                <span className="text-muted-foreground">
                  {fmt(avm_estimate, "currency")}
                </span>
              }
            />
          )}
          {avmDiscount != null && (
            <DetailRow
              label={avmDiscount >= 0 ? "Premium vs AVM" : "Discount vs AVM"}
              value={
                <span
                  className={
                    avmDiscount >= 0 ? "text-orange-500 font-semibold" : "text-emerald-600 font-semibold"
                  }
                >
                  {avmDiscount >= 0 ? "+" : ""}
                  {avmDiscount.toFixed(1)}%
                </span>
              }
            />
          )}
          {monthlyMortgage != null && (
            <DetailRow
              label="Est. Monthly Mortgage"
              value={
                <span className="text-muted-foreground">
                  {fmt(monthlyMortgage, "currency")}/mo
                </span>
              }
            />
          )}
          <DetailRow label="HOA Fee" value={hoa_fee ? fmt(hoa_fee, "currency") + "/mo" : "None"} />
          <DetailRow label="Annual Property Tax" value={property_tax ? fmt(property_tax, "currency") : "—"} />
        </SectionCard>

        {/* Price History */}
        {price_history && price_history.length > 0 && (
          <SectionCard title="Price History">
            {price_history.map((entry, i) => (
              <DetailRow
                key={i}
                label={entry.date}
                value={
                  <span className="flex items-center gap-2 justify-end">
                    <span className="text-muted-foreground text-xs">{entry.event}</span>
                    <span className="font-medium">{fmt(entry.price, "currency")}</span>
                  </span>
                }
              />
            ))}
            {last_sold_date && last_sold_price && (
              <DetailRow
                label="Last Sold"
                value={
                  <span className="flex items-center gap-2 justify-end">
                    <span className="text-muted-foreground text-xs">
                      {new Date(last_sold_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-medium">{fmt(last_sold_price, "currency")}</span>
                  </span>
                }
              />
            )}
          </SectionCard>
        )}

        {/* Structure */}
        <SectionCard title="Structure">
          <DetailRow label="Bedrooms" value={beds ?? "—"} />
          <DetailRow label="Bathrooms" value={baths ?? "—"} />
          <DetailRow
            label="Interior"
            value={sqft ? `${sqft.toLocaleString()} sqft` : "—"}
          />
          <DetailRow
            label="Lot Size"
            value={lot_sqft ? `${lot_sqft.toLocaleString()} sqft` : "—"}
          />
          <DetailRow label="Year Built" value={year_built ?? "—"} />
          <DetailRow label="Property Type" value={property_type ?? "—"} />
          <DetailRow label="Parking" value={parking ?? "—"} />
        </SectionCard>

        {/* Schools */}
        {schools && schools.length > 0 && (
          <SectionCard title="Schools (within 3 miles)">
            {schools.map((school, i) => (
              <DetailRow
                key={i}
                label={
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${scoreColor(school.rating)}`}
                    >
                      {school.rating}/10
                    </span>
                    <span className="capitalize">{school.type}</span>
                  </span>
                }
                value={
                  <span className="flex items-center gap-2">
                    <span>{school.name}</span>
                    {school.distance_mi != null && (
                      <span className="text-muted-foreground text-xs">
                        {school.distance_mi} mi
                      </span>
                    )}
                  </span>
                }
              />
            ))}
          </SectionCard>
        )}

        {/* Environment */}
        <SectionCard title="Environment">
          {noise_db != null && noiseBucket && (
            <DetailRow
              label="Noise Level"
              value={
                <span className="flex items-center gap-2">
                  <span className="font-medium">{noise_db} dB</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                      noiseBucket === "Quiet"
                        ? "bg-emerald-100 text-emerald-800"
                        : noiseBucket === "Moderate"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {noiseBucket}
                  </span>
                </span>
              }
            />
          )}
          {crime_safety_score != null && (
            <DetailRow
              label="Crime Safety"
              value={
                <span className="flex items-center gap-2">
                  <span className="font-medium">{crime_safety_score}/100</span>
                  {crime_label && (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                        crime_label === "Low"
                          ? "bg-emerald-100 text-emerald-800"
                          : crime_label === "Moderate"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {crime_label}
                    </span>
                  )}
                </span>
              }
            />
          )}
          {walkability_score != null && (
            <DetailRow
              label="Walkability"
              value={
                <span className="flex items-center gap-2">
                  <span className="font-medium">{walkability_score}/100</span>
                </span>
              }
            />
          )}
        </SectionCard>

        {/* Lifestyle */}
        <SectionCard title="Lifestyle">
          {lifestyle_walk_score != null && (
            <DetailRow
              label="Walk Score"
              value={
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                    lifestyle_walk_score >= 70
                      ? "bg-emerald-100 text-emerald-800"
                      : lifestyle_walk_score >= 50
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {lifestyle_walk_score}
                </span>
              }
            />
          )}
          {lifestyle_transit_score != null && (
            <DetailRow
              label="Transit Score"
              value={
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                    lifestyle_transit_score >= 70
                      ? "bg-emerald-100 text-emerald-800"
                      : lifestyle_transit_score >= 50
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {lifestyle_transit_score}
                </span>
              }
            />
          )}
          {lifestyle_bike_score != null && (
            <DetailRow
              label="Bike Score"
              value={
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                    lifestyle_bike_score >= 70
                      ? "bg-emerald-100 text-emerald-800"
                      : lifestyle_bike_score >= 50
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {lifestyle_bike_score}
                </span>
              }
            />
          )}
          {lifestyle_walk_score == null &&
            lifestyle_transit_score == null &&
            lifestyle_bike_score == null && (
              <div className="py-3 text-sm text-muted-foreground">
                Lifestyle scores will appear after enrichment completes.
              </div>
            )}
        </SectionCard>

        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground text-center">
          Listing data from Redfin · AVM from automated valuation model · Last updated:{" "}
          {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
