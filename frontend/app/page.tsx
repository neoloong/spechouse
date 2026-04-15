import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import ScoreBadge from "@/components/ScoreBadge";
import { ArrowRight, Home, TrendingUp, Leaf } from "lucide-react";
import { fmt } from "@/lib/api";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center py-20 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
            Which property is<br />actually worth more?
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Compare any 2–4 properties. See value, investment, and livability scores in one view.
          </p>
        </div>

        <SearchBar />

        {/* Score badges */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <ScoreBadge label="🏠 Value" score={undefined} />
          <ScoreBadge label="💰 Investment" score={undefined} />
          <ScoreBadge label="🌿 Environment" score={undefined} />
        </div>
      </section>

      {/* ── Example comparison ── */}
      <section className="py-16 px-4 bg-muted/10">
        <div className="container mx-auto max-w-4xl">
          <p className="text-sm text-muted-foreground text-center mb-6 uppercase tracking-wide font-medium">
            See how it works
          </p>
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            {/* Comparison header */}
            <div className="grid grid-cols-3 gap-4 p-4 border-b bg-muted/30">
              <div className="text-sm font-semibold text-muted-foreground">Property</div>
              <div className="text-sm font-semibold text-center">
                <span className="flex items-center justify-center gap-1">
                  <Home className="w-4 h-4" /> 742 Evergreen
                </span>
              </div>
              <div className="text-sm font-semibold text-center">
                <span className="flex items-center justify-center gap-1">
                  <Home className="w-4 h-4" /> 1640 Riverside
                </span>
              </div>
            </div>

            {/* Price row */}
            <ComparisonRow
              label="Price"
              left="$1,250,000"
              right="$875,000"
              leftSub="4 bd 2.5 ba 2,100 sqft"
              rightSub="3 bd 2 ba 1,850 sqft"
            />

            {/* Score row */}
            <ComparisonRow
              label="Overall Score"
              left={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={7.2} size="sm" />
                  <span className="text-xs text-muted-foreground">Good</span>
                </span>
              }
              right={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={8.1} size="sm" />
                  <span className="text-xs text-muted-foreground">Great</span>
                </span>
              }
              highlight="right"
            />

            {/* Value score */}
            <ComparisonRow
              label="Value Score"
              left={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={7.5} size="sm" />
                </span>
              }
              right={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={8.3} size="sm" />
                </span>
              }
              highlight="right"
            />

            {/* Investment score */}
            <ComparisonRow
              label="Investment"
              left={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={6.8} size="sm" />
                </span>
              }
              right={
                <span className="inline-flex items-center gap-1.5">
                  <ScoreBadge score={7.9} size="sm" />
                </span>
              }
              highlight="right"
            />

            {/* City row */}
            <ComparisonRow
              label="City"
              left="San Francisco, CA"
              right="Austin, TX"
            />
          </div>

          {/* CTA */}
          <div className="text-center mt-6">
            <Link
              href="/compare?ids=1,2"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              See full comparison
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature bullets (kept from original) ── */}
      <div className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-sm">
            {[
              { icon: "📊", title: "Spec Comparison", desc: "Compare up to 4 properties spec-by-spec with diff highlighting." },
              { icon: "🔇", title: "Noise & Crime", desc: "See real noise dB and crime scores Zillow won't show you." },
              { icon: "📈", title: "Investment Scores", desc: "Rental yield, cap rate, and AVM discount — all in one score." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-4 rounded-xl border bg-card">
                <div className="text-3xl mb-2">{icon}</div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ComparisonRow({
  label,
  left,
  right,
  leftSub,
  rightSub,
  highlight,
}: {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
  leftSub?: string;
  rightSub?: string;
  highlight?: "left" | "right";
}) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={`text-center ${highlight === "left" ? "bg-emerald-50 rounded-lg -mx-1 px-1" : ""}`}>
        <div className="flex flex-col items-center">{left}</div>
        {leftSub && <p className="text-xs text-muted-foreground mt-0.5">{leftSub}</p>}
      </div>
      <div className={`text-center ${highlight === "right" ? "bg-emerald-50 rounded-lg -mx-1 px-1" : ""}`}>
        <div className="flex flex-col items-center">{right}</div>
        {rightSub && <p className="text-xs text-muted-foreground mt-0.5">{rightSub}</p>}
      </div>
    </div>
  );
}