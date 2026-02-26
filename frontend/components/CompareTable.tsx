"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import ScoreBadge from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { fmt, type PropertySpec } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

type CellValue = string | number | null | undefined;

interface SpecRow {
  label: string;
  key: keyof PropertySpec;
  format?: (v: number) => string;
  higherIsBetter?: boolean; // true = green for highest, false = green for lowest
  isText?: boolean;
  renderCell?: (p: PropertySpec) => React.ReactNode; // custom per-cell renderer
}

const SPEC_SECTIONS: { title: string; rows: SpecRow[] }[] = [
  {
    title: "Financials",
    rows: [
      { label: "List Price", key: "list_price", format: (v) => fmt(v, "currency"), higherIsBetter: false },
      { label: "Price / sqft", key: "price_per_sqft", format: (v) => `${fmt(v, "currency", 0)}/sqft`, higherIsBetter: false },
      { label: "Rental Estimate", key: "rental_estimate", format: (v) => `${fmt(v, "currency")}/mo`, higherIsBetter: true },
      { label: "Rental Yield", key: "rental_yield_pct", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
      { label: "Cap Rate", key: "cap_rate", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
      { label: "HOA Fee", key: "hoa_fee", format: (v) => fmt(v, "currency"), higherIsBetter: false },
      { label: "Property Tax", key: "property_tax", format: (v) => `${fmt(v, "currency")}/yr`, higherIsBetter: false },
    ],
  },
  {
    title: "Property Specs",
    rows: [
      { label: "Bedrooms", key: "beds", higherIsBetter: true },
      { label: "Bathrooms", key: "baths", higherIsBetter: true },
      { label: "Interior Sqft", key: "sqft", format: (v) => `${v.toLocaleString()} sqft`, higherIsBetter: true },
      { label: "Lot Size", key: "lot_sqft", format: (v) => `${v.toLocaleString()} sqft`, higherIsBetter: true },
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
      { label: "Crime Score", key: "crime_score", format: (v) => `${v.toFixed(0)}/100`, higherIsBetter: false },
    ],
  },
  {
    title: "Schools",
    rows: [
      { label: "Schools within 3mi", key: "schools_count", higherIsBetter: true },
      { label: "Nearest School", key: "nearest_school", isText: true },
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

interface Props {
  properties: PropertySpec[];
}

export default function CompareTable({ properties }: Props) {
  const [diffsOnly, setDiffsOnly] = useState(false);

  const n = properties.length;

  return (
    <div>
      {/* Controls */}
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
          {/* Header */}
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 w-44 font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10">
                Spec
              </th>
              {properties.map((p) => (
                <th key={p.id} className="p-3 text-center min-w-40">
                  <div className="font-semibold leading-tight">{p.address_display.split(",")[0]}</div>
                  <div className="text-xs font-normal text-muted-foreground mt-0.5">
                    {[p.city, p.state].filter(Boolean).join(", ")}
                  </div>
                  <div className="mt-1">
                    <ScoreBadge score={p.score_overall} size="sm" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SPEC_SECTIONS.map(({ title, rows }) => {
              const visibleRows = rows.filter((row) => {
                if (!diffsOnly) return true;
                const vals = properties.map((p) => p[row.key]);
                return !allSame(vals);
              });

              if (visibleRows.length === 0) return null;

              return [
                // Section header
                <tr key={`section-${title}`} className="bg-muted/30">
                  <td
                    colSpan={n + 1}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0"
                  >
                    {title}
                  </td>
                </tr>,
                // Data rows
                ...visibleRows.map((row) => {
                  const rawValues = properties.map((p) => p[row.key] as CellValue);
                  const sameForAll = allSame(rawValues);

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-t hover:bg-muted/20 transition-colors",
                        sameForAll && diffsOnly && "hidden"
                      )}
                    >
                      <td className="p-3 text-muted-foreground font-medium sticky left-0 bg-background">
                        {row.label}
                      </td>
                      {properties.map((p) => {
                        const raw = p[row.key] as CellValue;
                        const highlight = row.isText
                          ? "neutral"
                          : getCellHighlight(raw, rawValues, row.higherIsBetter);

                        let display: React.ReactNode = "—";
                        if (row.renderCell) {
                          display = row.renderCell(p) ?? "—";
                        } else if (raw != null) {
                          if (row.isText) {
                            display = String(raw);
                          } else if (row.key.startsWith("score_") && typeof raw === "number") {
                            display = <ScoreBadge score={raw} size="sm" />;
                          } else if (row.format && typeof raw === "number") {
                            display = row.format(raw);
                          } else {
                            display = String(raw);
                          }
                        }

                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "p-3 text-center transition-colors",
                              highlight === "best" && "bg-emerald-50 text-emerald-700 font-semibold",
                              highlight === "worst" && "bg-red-50 text-red-700"
                            )}
                          >
                            {display}
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
        <span className="inline-block w-3 h-3 rounded bg-emerald-100 mr-1" />
        Best value &nbsp;
        <span className="inline-block w-3 h-3 rounded bg-red-100 mr-1 ml-3" />
        Worst value
      </p>
    </div>
  );
}
