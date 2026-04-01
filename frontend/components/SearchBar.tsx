"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Sparkles } from "lucide-react";
import { parseSearch } from "@/lib/api";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";

interface Props {
  defaultCity?: string;
  defaultBeds?: string;
  defaultMaxPrice?: string;
}

// Detect natural-language queries that benefit from AI parsing
const NL_PATTERN = /\b(bed|bath|br\b|ba\b|house|condo|townhouse|under|max|below|\$\d|sqft|sq\s*ft|school|score|near|studio|single.family|multi.family)\b/i;
const isNLQuery = (q: string) => q.trim().split(/\s+/).length > 2 && NL_PATTERN.test(q);

export default function SearchBar({ defaultCity = "", defaultBeds = "", defaultMaxPrice = "" }: Props) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [beds, setBeds] = useState(defaultBeds);
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice);
  const [parsing, setParsing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Debounce: auto-search after 800ms of typing (for quick city/ZIP searches)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleInputChange = (value: string) => {
    setCity(value);
    
    // Cancel previous timer
    if (debounceTimer) clearTimeout(debounceTimer);
    
    // Skip debounce for complex NL queries (let user finish typing)
    if (value.trim().length >= 3 && !isNLQuery(value)) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams();
        if (/^\d{5}$/.test(value.trim())) {
          params.set("zip_code", value.trim());
        } else {
          params.set("city", value.trim());
        }
        if (beds) params.set("beds", beds);
        if (maxPrice) params.set("max_price", maxPrice);
        startTransition(() => {
          router.push(`/listings?${params.toString()}`);
        });
      }, 800);
      setDebounceTimer(timer);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = city.trim();
    if (!q) return;

    // Cancel debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }

    const params = new URLSearchParams();

    if (isNLQuery(q)) {
      // ── AI natural language parse ────────────────────────────────────────
      setParsing(true);
      try {
        const parsed = await parseSearch(q);
        if (parsed.city) params.set("city", parsed.city);
        if (parsed.state) params.set("state", parsed.state);
        if (parsed.beds) params.set("beds", String(parsed.beds));
        if (parsed.baths) params.set("min_baths", String(parsed.baths));
        if (parsed.max_price) params.set("max_price", String(parsed.max_price));
        if (parsed.min_price) params.set("min_price", String(parsed.min_price));
        if (parsed.property_type) params.set("property_type", parsed.property_type);
        if (parsed.min_sqft) params.set("min_sqft", String(parsed.min_sqft));
        if (parsed.parsed_summary) params.set("ai_query", parsed.parsed_summary);
        // Fallback: if AI couldn't extract city, treat whole query as city
        if (!parsed.city) params.set("city", q);
      } catch {
        // AI parse failed → plain city search
        params.set("city", q);
      } finally {
        setParsing(false);
      }
    } else if (/^\d{5}$/.test(q)) {
      // ── ZIP code ─────────────────────────────────────────────────────────
      params.set("zip_code", q);
      if (beds) params.set("beds", beds);
      if (maxPrice) params.set("max_price", maxPrice);
    } else {
      // ── Plain city search ────────────────────────────────────────────────
      params.set("city", q);
      if (beds) params.set("beds", beds);
      if (maxPrice) params.set("max_price", maxPrice);
    }

    trackEvent(AnalyticsEvents.SEARCH, {
      query: q,
      city: params.get("city") ?? '',
      zip_code: params.get("zip_code") ?? '',
      beds: params.get("beds") ?? '',
      max_price: params.get("max_price") ?? '',
      is_nl_query: isNLQuery(q),
    });
    router.push(`/listings?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
      <div className="flex-1 relative">
        <Input
          placeholder='City, ZIP, or try "3br house in Austin under $600k"'
          value={city}
          onChange={(e) => handleInputChange(e.target.value)}
          className="flex-1 h-12 text-base pr-10"
          required
        />
        {/* AI detection indicator */}
        {city.trim().length > 3 && isNLQuery(city) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" title="AI will parse this query">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>
      <Input
        placeholder="Min beds"
        type="number"
        min={0}
        value={beds}
        onChange={(e) => setBeds(e.target.value)}
        className="w-28 h-12 text-base"
      />
      <Input
        placeholder="Max price"
        type="number"
        min={0}
        step={50000}
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
        className="w-36 h-12 text-base"
      />
      <Button type="submit" size="lg" className="h-12 px-6" disabled={parsing || isPending}>
        {parsing || isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {parsing ? "Parsing…" : "Loading…"}
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            Search
          </>
        )}
      </Button>
    </form>
  );
}
