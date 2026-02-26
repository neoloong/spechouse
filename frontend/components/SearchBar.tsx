"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { parseSearch } from "@/lib/api";

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    if (!q) return;

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

    router.push(`/listings?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
      <Input
        placeholder='City, ZIP, or try "3br house in Austin under $600k"'
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="flex-1 h-12 text-base"
        required
      />
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
      <Button type="submit" size="lg" className="h-12 px-6" disabled={parsing}>
        {parsing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Parsing…
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
