import { notFound } from "next/navigation";
import Link from "next/link";
import { getProperty, fmt, type PropertyDetail } from "@/lib/api";
import ScoreBadge from "@/components/ScoreBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, GitCompareArrows } from "lucide-react";

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wide text-xs">
        {title}
      </h2>
      <div className="rounded-xl border bg-card px-4">{children}</div>
    </div>
  );
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let property: PropertyDetail;
  try {
    property = await getProperty(Number(id));
  } catch {
    notFound();
  }

  const agg = property.agg_data ?? {};
  const rental = agg.rental ?? {};
  const env = agg.environment ?? {};
  const scores = agg.scores ?? {};

  const pricePerSqft =
    property.list_price && property.sqft
      ? property.list_price / property.sqft
      : null;

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
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Photo gallery */}
        {property.photos && property.photos.length > 0 ? (
          <div className="mb-8 rounded-xl overflow-hidden grid grid-cols-1 gap-1">
            <img
              src={property.photos[0]}
              alt={property.address_display}
              className="w-full h-80 object-cover"
            />
            {property.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-1">
                {property.photos.slice(1, 5).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full h-24 object-cover" />
                ))}
              </div>
            )}
          </div>
        ) : property.photo_url ? (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img src={property.photo_url} alt={property.address_display} className="w-full h-80 object-cover" />
          </div>
        ) : null}

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <h1 className="text-2xl font-bold flex-1 min-w-0">{property.address_display}</h1>
            <ScoreBadge score={scores.overall} label="/100" />
          </div>
          <p className="text-muted-foreground mb-4">
            {[property.city, property.state, property.zip_code].filter(Boolean).join(", ")}
            {property.property_type && (
              <Badge variant="outline" className="ml-2 text-xs">
                {property.property_type}
              </Badge>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-3xl font-black">{fmt(property.list_price, "currency")}</p>
            <Link href={`/compare?ids=${property.id}`}>
              <Button size="sm" variant="outline">
                <GitCompareArrows className="w-4 h-4 mr-1" />
                Add to compare
              </Button>
            </Link>
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Overall", score: scores.overall },
            { label: "Value", score: scores.value },
            { label: "Investment", score: scores.investment },
          ].map(({ label, score }) => (
            <div key={label} className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{label} Score</p>
              <ScoreBadge score={score} />
            </div>
          ))}
        </div>

        {/* Financials */}
        <Section title="Financials">
          <Row label="List Price" value={fmt(property.list_price, "currency")} />
          <Row label="Price / sqft" value={pricePerSqft ? `${fmt(pricePerSqft, "currency", 0)}/sqft` : "—"} />
          <Row label="Rental Estimate (monthly)" value={rental.estimate ? fmt(rental.estimate, "currency") : "—"} />
          <Row label="Gross Rental Yield" value={rental.yield_pct ? `${rental.yield_pct.toFixed(1)}%` : "—"} />
          <Row label="Est. Cap Rate" value={rental.cap_rate ? `${rental.cap_rate.toFixed(1)}%` : "—"} />
          <Row label="HOA Fee (monthly)" value={property.hoa_fee ? fmt(property.hoa_fee, "currency") : "None"} />
          <Row label="Annual Property Tax" value={property.property_tax ? fmt(property.property_tax, "currency") : "—"} />
        </Section>

        {/* Property Specs */}
        <Section title="Property Specs">
          <Row label="Bedrooms" value={property.beds ?? "—"} />
          <Row label="Bathrooms" value={property.baths ?? "—"} />
          <Row label="Interior Sqft" value={property.sqft ? property.sqft.toLocaleString() + " sqft" : "—"} />
          <Row label="Lot Size" value={property.lot_sqft ? property.lot_sqft.toLocaleString() + " sqft" : "—"} />
          <Row label="Year Built" value={property.year_built ?? "—"} />
          <Row label="Property Type" value={property.property_type ?? "—"} />
        </Section>

        {/* Environment */}
        <Section title="Environment">
          <Row
            label="Noise Level"
            value={
              env.noise_db != null ? (
                <span>
                  {env.noise_db.toFixed(0)} dB
                  {env.noise_label && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {env.noise_label}
                    </Badge>
                  )}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Crime Score"
            value={
              env.crime_score != null ? (
                <span>{env.crime_score.toFixed(0)} / 100 (lower = safer)</span>
              ) : (
                "—"
              )
            }
          />
        </Section>

        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground text-center">
          Data sourced from Rentcast, HowLoud. Last enriched:{" "}
          {property.last_enriched ? new Date(property.last_enriched).toLocaleDateString() : "pending"}
        </p>
      </div>
    </div>
  );
}
