"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import ScoreBadge from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { fmt, type PropertySpec } from "@/lib/api";
import { Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";

type CellValue = string | number | null | undefined;

function renderSchoolCell(value: string | undefined) {
  if (!value) return "—";
  // Extract rating from string like "Roosevelt High School (10/10)"
  const match = value.match(/\((\d+)\/10\)/);
  if (!match) return value;
  const rating = parseInt(match[1]);
  const name = value.replace(/\s*\(\d+\/10\)/, "");
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
        rating >= 8 ? "bg-emerald-100 text-emerald-800" :
        rating >= 6 ? "bg-green-100 text-green-800" :
        rating >= 4 ? "bg-yellow-100 text-yellow-800" :
        "bg-red-100 text-red-800"
      }`}>{rating}/10</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

interface SpecRow {
  label: string;
  key?: keyof PropertySpec;
  format?: (v: number | undefined) => string;
  higherIsBetter?: boolean;
  isText?: boolean;
  renderCell?: (p: PropertySpec) => React.ReactNode;
}

const SPEC_SECTIONS: { title: string; rows: SpecRow[] }[] = [
  {
    title: "Financials",
    rows: [
      { label: "Status", key: "status", format: (v) => {
        const s = String(v);
        return s === "for_sale" ? "For Sale" : s === "sold" ? "Sold" : s === "pending" ? "Pending" : s || "—";
      }},
      { label: "List Price", key: "list_price", format: (v) => fmt(v, "currency"), higherIsBetter: false },
      { label: "Price / sqft", key: "price_per_sqft", format: (v) => `${fmt(v, "currency", 0)}/sqft`, higherIsBetter: false },
      { label: "Rental Estimate", key: "rental_estimate", format: (v) => `${fmt(v, "currency")}/mo`, higherIsBetter: true },
      { label: "Rental Yield", key: "rental_yield_pct", format: (v) => v != null ? `${v.toFixed(1)}%` : "—", higherIsBetter: true },
      { label: "Cap Rate", key: "cap_rate", format: (v) => v != null ? `${v.toFixed(1)}%` : "—", higherIsBetter: true },
      { label: "HOA Fee", key: "hoa_fee", format: (v) => fmt(v, "currency"), higherIsBetter: false },
      { label: "Property Tax", key: "property_tax", format: (v) => `${fmt(v, "currency")}/yr`, higherIsBetter: false },
    ],
  },
  {
    title: "Market Comparison",
    rows: [
      {
        label: "Zillow City Median",
        renderCell: (p) => p.zillow_city_median ? `${fmt(p.zillow_city_median, "currency")}/mo` : "—",
        higherIsBetter: undefined,
      },
      {
        label: "Our Model Est.",
        key: "rental_estimate",
        format: (v) => v != null ? `${fmt(v, "currency")}/mo` : "—",
        higherIsBetter: undefined,
      },
      {
        label: "vs. City Median",
        renderCell: (p) => {
          const our = p.rental_estimate;
          const city = p.zillow_city_median;
          if (!our || !city) return "—";
          const diff = ((our - city) / city) * 100;
          const cls = diff >= 0 ? "text-emerald-600" : diff < -10 ? "text-orange-500" : "text-yellow-600";
          return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
        },
        higherIsBetter: undefined,
      },
    ],
  },
  {
    title: "Property Specs",
    rows: [
      { label: "Bedrooms", key: "beds", higherIsBetter: true },
      { label: "Bathrooms", key: "baths", higherIsBetter: true },
      { label: "Interior Sqft", key: "sqft", format: (v) => v != null ? `${v.toLocaleString()} sqft` : "—", higherIsBetter: true },
      { label: "Lot Size", key: "lot_sqft", format: (v) => v != null ? `${v.toLocaleString()} sqft` : "—", higherIsBetter: true },
      { label: "Year Built", key: "year_built", higherIsBetter: true },
      { label: "Property Type", key: "property_type", isText: true },
      { label: "City", key: "city", isText: true },
      { label: "ZIP", key: "zip_code", isText: true },
    ],
  },
  {
    title: "Environment",
    rows: [
      {
        label: "Noise Level",
        key: "noise_db",
        higherIsBetter: false,
        renderCell: (p) => {
          const db = p.noise_db;
          const label = p.noise_label;
          if (db == null && !label) return "—";
          if (db == null) return label ?? "—";
          return label ? `${db.toFixed(0)} dB — ${label}` : `${db.toFixed(0)} dB`;
        },
      },
      { 
        label: "Noise Score", 
        key: "noise_score", 
        renderCell: (p) => {
          const v = p.noise_score;
          const l = p.noise_label;
          return v != null ? `${v.toFixed(0)}/10 ${l ? `(${l})` : ''}` : 'N/A';
        },
        higherIsBetter: true 
      },
      { 
        label: "Crime Score", 
        key: "crime_score", 
        renderCell: (p) => {
          const v = p.crime_score;
          const l = p.crime_label;
          return v != null ? `${v}/100 ${l ? `(${l})` : ''}` : 'N/A';
        },
        higherIsBetter: true 
      },
    ],
  },
  {
    title: "Schools",
    rows: [
      { 
        label: "Elementary School", 
        renderCell: (p) => renderSchoolCell(p.school_elementary) 
      },
      { 
        label: "Middle School", 
        renderCell: (p) => renderSchoolCell(p.school_middle) 
      },
      { 
        label: "High School", 
        renderCell: (p) => renderSchoolCell(p.school_high) 
      },
    ],
  },
  {
    title: "SpecHouse Scores",
    rows: [
      { label: "Overall Score", key: "score_overall", higherIsBetter: true },
      { label: "Value Score", key: "score_value", higherIsBetter: true },
      { label: "Investment Score", key: "score_investment", higherIsBetter: true },
    ],
  },
];

function getCellHighlight(
  value: CellValue,
  allValues: CellValue[],
  higherIsBetter: boolean | undefined
): "best" | "worst" | "neutral" {
  if (higherIsBetter === undefined) return "neutral";
  const nums = allValues.filter((v) => typeof v === "number" && !isNaN(v as number)) as number[];
  if (nums.length < 2) return "neutral";
  const best = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  const worst = higherIsBetter ? Math.min(...nums) : Math.max(...nums);
  if (value === best && best !== worst) return "best";
  if (value === worst && best !== worst) return "worst";
  return "neutral";
}

function allSame(values: CellValue[]): boolean {
  const strs = values.map((v) => String(v ?? ""));
  return strs.every((s) => s === strs[0]);
}

function formatCell(row: SpecRow, p: PropertySpec): React.ReactNode {
  if (row.renderCell) return row.renderCell(p) ?? "—";
  if (!row.key) return "—";
  const raw = p[row.key] as CellValue;
  if (raw == null) return "—";
  if (row.isText) return String(raw);
  if (row.key.startsWith("score_") && typeof raw === "number") {
    return <ScoreBadge score={raw} size="sm" />;
  }
  if (row.format && typeof raw === "number") return row.format(raw);
  return String(raw);
}

interface Props {
  properties: PropertySpec[];
}

// ── Mobile: swipeable card view ───────────────────────────────────────────────
function MobileCompare({ properties }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const p = properties[activeIdx];
  const n = properties.length;

  return (
    <div>
      {/* Property switcher */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button
          size="icon"
          variant="outline"
          disabled={activeIdx === 0}
          onClick={() => setActiveIdx((i) => i - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex-1 text-center">
          <div className="flex justify-center gap-1.5 mb-1">
            {properties.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === activeIdx ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{activeIdx + 1} of {n}</p>
        </div>

        <Button
          size="icon"
          variant="outline"
          disabled={activeIdx === n - 1}
          onClick={() => setActiveIdx((i) => i + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Active property card */}
      <div className="rounded-xl border bg-card overflow-hidden mb-4">
        {p.photo_url && (
          <img src={p.photo_url} alt={p.address_display} className="w-full h-40 object-cover" />
        )}
        <div className="p-4 border-b">
          <p className="font-semibold">{p.address_display.split(",")[0]}</p>
          <p className="text-sm text-muted-foreground">{[p.city, p.state].filter(Boolean).join(", ")}</p>
          <div className="flex gap-2 mt-2">
            <ScoreBadge score={p.score_overall} />
            {p.list_price && <span className="text-lg font-bold">{fmt(p.list_price, "currency")}</span>}
          </div>
        </div>

        {/* Spec rows for active property, with rank vs others */}
        <div className="divide-y">
          {SPEC_SECTIONS.map(({ title, rows }) => (
            <div key={title}>
              <div className="px-4 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </div>
              {rows.map((row) => {
                if (!row.key) return null;
                const raw = p[row.key] as CellValue;
                const allVals = properties.map((x) => x[row.key!] as CellValue);
                const highlight = row.isText ? "neutral" : getCellHighlight(raw, allVals, row.higherIsBetter);
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "flex justify-between items-center px-4 py-2.5 text-sm",
                      highlight === "best" && "bg-emerald-50",
                      highlight === "worst" && "bg-red-50"
                    )}
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn(
                      "font-medium text-right",
                      highlight === "best" && "text-emerald-700",
                      highlight === "worst" && "text-red-700"
                    )}>
                      {formatCell(row, p)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mini summary of all properties */}
      <p className="text-xs text-muted-foreground text-center mb-2">All properties at a glance</p>
      <div className="grid grid-cols-2 gap-2">
        {properties.map((prop, i) => (
          <button
            key={prop.id}
            onClick={() => setActiveIdx(i)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              i === activeIdx ? "border-primary bg-primary/5" : "bg-card"
            )}
          >
            <p className="text-xs font-semibold truncate">{prop.address_display.split(",")[0]}</p>
            <p className="text-xs text-muted-foreground">{fmt(prop.list_price, "currency")}</p>
            <ScoreBadge score={prop.score_overall} size="sm" />
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center">
        <span className="inline-block w-3 h-3 rounded bg-emerald-100 mr-1" />Best &nbsp;
        <span className="inline-block w-3 h-3 rounded bg-red-100 mr-1 ml-2" />Worst
      </p>
    </div>
  );
}

// ── Desktop: full side-by-side table ─────────────────────────────────────────
function DesktopCompare({ properties, diffsOnly, setDiffsOnly }: Props & {
  diffsOnly: boolean;
  setDiffsOnly: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const n = properties.length;
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          variant={diffsOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setDiffsOnly((v) => !v)}
        >
          {diffsOnly ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          {diffsOnly ? "Show all rows" : "Show diffs only"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 w-44 font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10">
                Spec
              </th>
              {properties.map((p) => (
                <th key={p.id} className="p-3 text-center min-w-44">
                  <div className="w-full h-28 rounded-lg overflow-hidden bg-muted mb-2">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.address_display} className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-muted to-muted/60">🏠</div>
                    )}
                  </div>
                  <div className="font-semibold leading-tight text-sm">{p.address_display.split(",")[0]}</div>
                  <div className="text-xs font-normal text-muted-foreground mt-0.5">
                    {[p.city, p.state].filter(Boolean).join(", ")}
                  </div>
                  <div className="mt-1"><ScoreBadge score={p.score_overall} size="sm" /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPEC_SECTIONS.map(({ title, rows }) => {
              const visibleRows = rows.filter((row) => {
                if (!diffsOnly) return true;
                if (!row.key) return false;
                const vals = properties.map((p) => p[row.key!]);
                return !allSame(vals);
              });
              if (visibleRows.length === 0) return null;
              return [
                <tr key={`section-${title}`} className="bg-muted/30">
                  <td colSpan={n + 1} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0">
                    {title}
                  </td>
                </tr>,
                ...visibleRows.map((row) => {
                  if (!row.key) return null;
                  const rawValues = properties.map((p) => p[row.key!] as CellValue);
                  const sameForAll = allSame(rawValues);
                  return (
                    <tr key={row.key} className={cn("border-t hover:bg-muted/20 transition-colors", sameForAll && diffsOnly && "hidden")}>
                      <td className="p-3 text-muted-foreground font-medium sticky left-0 bg-background">{row.label}</td>
                      {properties.map((p) => {
                        const raw = p[row.key!] as CellValue;
                        const highlight = row.isText ? "neutral" : getCellHighlight(raw, rawValues, row.higherIsBetter);
                        return (
                          <td key={p.id} className={cn(
                            "p-3 text-center transition-colors",
                            highlight === "best" && "bg-emerald-50 text-emerald-700 font-semibold",
                            highlight === "worst" && "bg-red-50 text-red-700"
                          )}>
                            {formatCell(row, p)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        <span className="inline-block w-3 h-3 rounded bg-emerald-100 mr-1" />Best value &nbsp;
        <span className="inline-block w-3 h-3 rounded bg-red-100 mr-1 ml-3" />Worst value
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CompareTable({ properties }: Props) {
  const [diffsOnly, setDiffsOnly] = useState(false);

  return (
    <>
      {/* Mobile */}
      <div className="block sm:hidden">
        <MobileCompare properties={properties} />
      </div>
      {/* Desktop */}
      <div className="hidden sm:block">
        <DesktopCompare properties={properties} diffsOnly={diffsOnly} setDiffsOnly={setDiffsOnly} />
      </div>
    </>
  );
}
