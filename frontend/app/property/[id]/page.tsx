import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const property = await getProperty(Number(id));
    const { address_display, city, state, list_price, beds, baths, sqft } = property;
    const title = `${address_display} - ${list_price ? `$${list_price.toLocaleString()}` : 'For Sale'} | SpecHouse`;
    const description = `${beds} bed, ${baths} bath, ${sqft?.toLocaleString() || '?'} sqft ${property.property_type || 'home'} in ${city}, ${state}. Compare prices, schools, noise, and crime on SpecHouse.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
      },
    };
  } catch {
    return { title: "Property Not Found" };
  }
}
import { getProperty, fmt, type PropertyDetail } from "@/lib/api";
import ScoreBadge from "@/components/ScoreBadge";
import BackButton from "@/components/BackButton";
import AddToCompareButton from "@/components/AddToCompareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

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
  const crimeData = agg.crime ?? null;
  const lifestyle = agg.lifestyle ?? {};
  const allSchools = agg.schools ?? [];

  // Extract noise score from lifestyle data (quiet_area, silent_zone, low_noise)
  const noiseKeys = ["silent_zone", "quiet_area", "low_noise", "noisy_area", "some_noise"];
  const noiseData = noiseKeys
    .map((k) => lifestyle[k])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0] || null;
  const noiseLevel = noiseData
    ? `${noiseData.score.toFixed(0)}/10 (${noiseData.label})`
    : null;

  // Filter to K-12 only, pick one per level (elementary/middle/high)
  const inferLevel = (s: { name: string; level?: string | null; type: string }): "elementary" | "middle" | "high" | null => {
    // Redfin assigned schools already have type set correctly
    if (s.type === "elementary") return "elementary";
    if (s.type === "middle") return "middle";
    if (s.type === "high") return "high";
    if (s.type === "college" || s.type === "university") return null;
    // OSM fallback: parse numeric level field
    if (s.level) {
      const parts = s.level.split(",").map(Number);
      if (parts.includes(3)) return "high";
      if (parts.includes(2)) return "middle";
      if (parts.includes(0) || parts.includes(1)) return "elementary";
    }
    const n = s.name.toLowerCase();
    if (n.includes("high school") || n.includes("senior high")) return "high";
    if (n.includes("middle") || n.includes("junior high")) return "middle";
    if (n.includes("elementary") || n.includes("primary") || n.includes("grammar")) return "elementary";
    return null;
  };

  const schoolsByLevel: { elementary?: typeof allSchools[0]; middle?: typeof allSchools[0]; high?: typeof allSchools[0] } = {};
  for (const s of allSchools) {
    const lvl = inferLevel(s);
    if (lvl && !schoolsByLevel[lvl]) schoolsByLevel[lvl] = s;
  }
  const schools = [
    schoolsByLevel.elementary && { ...schoolsByLevel.elementary, _level: "Elementary" },
    schoolsByLevel.middle && { ...schoolsByLevel.middle, _level: "Middle School" },
    schoolsByLevel.high && { ...schoolsByLevel.high, _level: "High School" },
  ].filter(Boolean) as (typeof allSchools[0] & { _level: string })[];
  // Only show schools that have ratings (from Redfin)
  const schoolsWithRatings = schools.filter(s => (s as { rating?: number }).rating != null);
  const redfinUrl: string | undefined = (agg as Record<string, unknown>)._redfin_url as string | undefined;

  const pricePerSqft =
    property.list_price && property.sqft
      ? property.list_price / property.sqft
      : null;

  // Construct Zillow search URL from address
  const zillowUrl = property.address_display
    ? `https://www.zillow.com/homes/${encodeURIComponent(property.address_display)}/`
    : null;

  const photoUrl = property.photo_url || (property.photos && property.photos[0]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-black text-lg shrink-0">
            Spec<span className="text-primary">House</span>
          </Link>
          <BackButton />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Photo */}
        {photoUrl && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={photoUrl}
              alt={property.address_display}
              className="w-full h-80 object-cover"
            />
          </div>
        )}

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
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-3xl font-black">{fmt(property.list_price, "currency")}</p>
            <AddToCompareButton propertyId={property.id} />
            {redfinUrl && (
              <a href={redfinUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Redfin
                </Button>
              </a>
            )}
            {zillowUrl && (
              <a href={zillowUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Zillow
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-3 mb-2">
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
        <p className="text-xs text-muted-foreground mb-8 px-1">
          Scores reflect available data. Missing noise/crime signals default to neutral (50).
          Expensive markets naturally score lower on rental yield — that&apos;s expected.
        </p>

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
              noiseData ? (
                <span className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                    noiseData.score >= 8 ? "bg-emerald-100 text-emerald-800" :
                    noiseData.score >= 6 ? "bg-green-100 text-green-800" :
                    noiseData.score >= 4 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }`}>{noiseData.label}</span>
                  <span>{noiseData.score.toFixed(0)}/10</span>
                </span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )
            }
          />
          <Row
            label="Crime"
            value={
              crimeData ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                    crimeData.label === "Low" ? "bg-emerald-100 text-emerald-800" :
                    crimeData.label === "Moderate" ? "bg-yellow-100 text-yellow-800" :
                    crimeData.label === "High" ? "bg-orange-100 text-orange-800" :
                    "bg-red-100 text-red-800"
                  }`}>{crimeData.label}</span>
                  <span className="text-sm">{crimeData.safety_score}/100 safety</span>
                  <span className="text-muted-foreground text-xs">({crimeData.violent_count} violent / {crimeData.total_count} total within 0.5mi)</span>
                </span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )
            }
          />
        </Section>

        {/* Schools */}
        <Section title="Schools in Area">
          {schoolsWithRatings.length === 0 ? (
            <div className="py-3 text-sm text-muted-foreground">
              School data will appear after enrichment completes.
            </div>
          ) : (
            schoolsWithRatings.map((s, i) => (
              <Row
                key={i}
                label={s._level}
                value={
                  <span className="flex items-center gap-2 flex-wrap">
                    {(s as unknown as { rating?: number }).rating != null && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        {(s as unknown as { rating: number }).rating}/10
                      </span>
                    )}
                    <span>{s.name}</span>
                    {(s as unknown as { grade_range?: string }).grade_range && (
                      <span className="text-muted-foreground text-xs">({(s as unknown as { grade_range: string }).grade_range})</span>
                    )}
                    {s.distance_mi != null && (
                      <span className="text-muted-foreground font-normal text-xs">
                        {s.distance_mi} mi
                      </span>
                    )}
                  </span>
                }
              />
            ))
          )}
        </Section>

        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground text-center">
          Listing data from Redfin · Rental estimates from HUD FY2024 FMR · Last enriched:{" "}
          {property.last_enriched ? new Date(property.last_enriched).toLocaleDateString() : "pending"}
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            name: property.address_display,
            description: `${property.beds} bed, ${property.baths} bath home in ${property.city}`,
            url: `https://spechouse.vercel.app/property/${property.id}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: property.address_display,
              addressLocality: property.city,
              addressRegion: property.state,
              postalCode: property.zip_code,
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: property.latitude,
              longitude: property.longitude,
            },
            offers: {
              "@type": "Offer",
              price: property.list_price,
              priceCurrency: "USD",
            },
            numberOfRooms: (property.beds || 0) + ((property.baths || 0) % 1 >= 0.5 ? 0.5 : 0),
            floorSize: {
              "@type": "QuantitativeValue",
              value: property.sqft,
              unitCode: "FTK",
            },
          }),
        }}
      />
    </div>
  );
}
