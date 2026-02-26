"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

export interface FilterState {
  propertyType: string;  // "" | "house" | "condo" | "townhouse" | "multi-family" | "land"
  minBeds: number;       // 0 = any
  minBaths: number;      // 0 = any
  minPrice: number;      // 0 = no min
  maxPrice: number;      // 0 = no max
  minSqft: number;       // 0 = any
}

export const DEFAULT_FILTERS: FilterState = {
  propertyType: "",
  minBeds: 0,
  minBaths: 0,
  minPrice: 0,
  maxPrice: 0,
  minSqft: 0,
};

interface Props {
  value: FilterState;
  onChange: (v: FilterState) => void;
}

const HOME_TYPES = [
  { id: "", label: "All Types", icon: "🏘" },
  { id: "house", label: "House", icon: "🏠" },
  { id: "condo", label: "Condo", icon: "🏢" },
  { id: "townhouse", label: "Townhouse", icon: "🏗" },
  { id: "multi-family", label: "Multi-Family", icon: "🏘" },
];

const BED_OPTIONS = [0, 1, 2, 3, 4];
const BATH_OPTIONS = [0, 1, 1.5, 2, 3];

const PRICE_PRESETS = [
  100_000, 200_000, 300_000, 400_000, 500_000,
  600_000, 750_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000,
];

const SQFT_PRESETS = [500, 750, 1_000, 1_250, 1_500, 2_000, 2_500, 3_000, 4_000];

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function fmtBeds(n: number) { return n === 0 ? "Any" : `${n}+`; }
function fmtBaths(n: number) { return n === 0 ? "Any" : `${n}+`; }

// ── Compact pill button ───────────────────────────────────────────────────────
function Chip({ active, onClick, children, className }: {
  active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-all shrink-0",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── Popover filter panel ──────────────────────────────────────────────────────
function FilterPopover({ label, active, children }: {
  label: React.ReactNode; active?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-all shrink-0",
            active
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/50",
          )}
        >
          {label}
          <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-auto min-w-56" align="start" onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ── Price range picker ────────────────────────────────────────────────────────
function PricePopover({ minPrice, maxPrice, onChange }: {
  minPrice: number; maxPrice: number;
  onChange: (min: number, max: number) => void;
}) {
  const label = minPrice || maxPrice
    ? `${minPrice ? fmtPrice(minPrice) : "Any"} – ${maxPrice ? fmtPrice(maxPrice) : "Any"}`
    : "Price";

  return (
    <FilterPopover label={label} active={!!(minPrice || maxPrice)}>
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Min Price</p>
      <div className="flex flex-wrap gap-1 mb-3">
        <Chip active={minPrice === 0} onClick={() => onChange(0, maxPrice)}>Any</Chip>
        {PRICE_PRESETS.filter(p => !maxPrice || p < maxPrice).map(p => (
          <Chip key={p} active={minPrice === p} onClick={() => onChange(p, maxPrice)}>
            {fmtPrice(p)}
          </Chip>
        ))}
      </div>
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Max Price</p>
      <div className="flex flex-wrap gap-1">
        <Chip active={maxPrice === 0} onClick={() => onChange(minPrice, 0)}>Any</Chip>
        {PRICE_PRESETS.filter(p => !minPrice || p > minPrice).map(p => (
          <Chip key={p} active={maxPrice === p} onClick={() => onChange(minPrice, p)}>
            {fmtPrice(p)}
          </Chip>
        ))}
      </div>
    </FilterPopover>
  );
}

// ── Main FilterBar ────────────────────────────────────────────────────────────
export default function FilterBar({ value, onChange }: Props) {
  const set = (partial: Partial<FilterState>) => onChange({ ...value, ...partial });

  const hasActiveFilters =
    value.propertyType || value.minBeds || value.minBaths ||
    value.minPrice || value.maxPrice || value.minSqft;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Home type — always visible chips */}
      <div className="flex gap-1 items-center">
        {HOME_TYPES.map((t) => (
          <Chip key={t.id} active={value.propertyType === t.id} onClick={() => set({ propertyType: t.id })}>
            <span className="text-base leading-none">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </Chip>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      {/* Beds popover */}
      <FilterPopover
        label={value.minBeds ? `${fmtBeds(value.minBeds)} Beds` : "Beds"}
        active={!!value.minBeds}
      >
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Min Bedrooms</p>
        <div className="flex gap-1">
          {BED_OPTIONS.map((n) => (
            <Chip key={n} active={value.minBeds === n} onClick={() => set({ minBeds: n })}>
              {fmtBeds(n)}
            </Chip>
          ))}
        </div>
      </FilterPopover>

      {/* Baths popover */}
      <FilterPopover
        label={value.minBaths ? `${fmtBaths(value.minBaths)} Baths` : "Baths"}
        active={!!value.minBaths}
      >
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Min Bathrooms</p>
        <div className="flex gap-1">
          {BATH_OPTIONS.map((n) => (
            <Chip key={n} active={value.minBaths === n} onClick={() => set({ minBaths: n })}>
              {fmtBaths(n)}
            </Chip>
          ))}
        </div>
      </FilterPopover>

      {/* Price range */}
      <PricePopover
        minPrice={value.minPrice}
        maxPrice={value.maxPrice}
        onChange={(min, max) => set({ minPrice: min, maxPrice: max })}
      />

      {/* Size popover */}
      <FilterPopover
        label={value.minSqft ? `${value.minSqft.toLocaleString()}+ sqft` : "Size"}
        active={!!value.minSqft}
      >
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Min Size</p>
        <div className="flex flex-wrap gap-1">
          <Chip active={value.minSqft === 0} onClick={() => set({ minSqft: 0 })}>Any</Chip>
          {SQFT_PRESETS.map((n) => (
            <Chip key={n} active={value.minSqft === n} onClick={() => set({ minSqft: n })}>
              {n.toLocaleString()}+
            </Chip>
          ))}
        </div>
      </FilterPopover>

      {/* Clear all — only when filters are active */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}
