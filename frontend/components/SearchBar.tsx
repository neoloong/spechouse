"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Sparkles, MapPin } from "lucide-react";
import { parseSearch } from "@/lib/api";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CitySuggestion {
  city: string;
  state: string;
  displayName: string;
}

// ─── City normalization for autocomplete ─────────────────────────────────────

const CITY_SUGGESTIONS: CitySuggestion[] = [
  { city: "San Francisco", state: "CA", displayName: "San Francisco, CA" },
  { city: "Austin", state: "TX", displayName: "Austin, TX" },
  { city: "Seattle", state: "WA", displayName: "Seattle, WA" },
  { city: "New York", state: "NY", displayName: "New York, NY" },
];

function getSuggestions(input: string): CitySuggestion[] {
  if (!input.trim()) return [];
  const lower = input.toLowerCase();
  return CITY_SUGGESTIONS.filter(
    (s) =>
      s.city.toLowerCase().includes(lower) ||
      s.displayName.toLowerCase().includes(lower) ||
      s.state.toLowerCase().includes(lower)
  );
}

function normalizeCityQuery(query: string): string {
  const lower = query.toLowerCase().trim();
  if (lower === "sf") return "San Francisco, CA";
  if (lower === "nyc" || lower === "manhattan") return "New York, NY";
  if (lower === "san fran" || lower === "san francisco" || lower === "san francisco ca" || lower === "san francisco, ca") {
    return "San Francisco, CA";
  }
  if (lower === "austin" || lower === "austin tx" || lower === "austin, tx") return "Austin, TX";
  if (lower === "seattle" || lower === "seattle wa" || lower === "seattle, wa") return "Seattle, WA";
  if (lower === "new york" || lower === "new york ny" || lower === "new york, ny") return "New York, NY";
  return query.trim();
}

// Detect natural-language queries
const NL_PATTERN = /\b(bed|bath|br\b|ba\b|house|condo|townhouse|under|max|below|\$\d|sqft|sq\s*ft|school|score|near|studio|single.family|multi.family)\b/i;
const isNLQuery = (q: string) => q.trim().split(/\s+/).length > 2 && NL_PATTERN.test(q);

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  defaultCity?: string;
  defaultBeds?: string;
  defaultMaxPrice?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchBar({ defaultCity = "", defaultBeds = "", defaultMaxPrice = "" }: Props) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [beds, setBeds] = useState(defaultBeds);
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice);
  const [parsing, setParsing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce: auto-search after 800ms for quick city/ZIP searches
  const [autoSearchTimer, setAutoSearchTimer] = useState<NodeJS.Timeout | null>(null);

  const handleInputChange = (value: string) => {
    setCity(value);
    setSelectedIndex(-1);

    // Cancel previous timers
    if (debounceTimer) clearTimeout(debounceTimer);
    if (autoSearchTimer) clearTimeout(autoSearchTimer);

    // Update suggestions
    const newSuggestions = getSuggestions(value);
    setSuggestions(newSuggestions);
    setShowDropdown(newSuggestions.length > 0);

    // Skip debounce for complex NL queries
    if (value.trim().length >= 3 && !isNLQuery(value)) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams();
        if (/^\d{5}$/.test(value.trim())) {
          params.set("zip_code", value.trim());
        } else {
          const normalized = normalizeCityQuery(value);
          params.set("city", normalized);
        }
        if (beds) params.set("beds", beds);
        if (maxPrice) params.set("max_price", maxPrice);
        startTransition(() => {
          router.push(`/listings?${params.toString()}`);
        });
      }, 800);
      setAutoSearchTimer(timer);
    }
  };

  const navigateToCity = useCallback(
    (cityValue: string) => {
      const params = new URLSearchParams();
      if (/^\d{5}$/.test(cityValue)) {
        params.set("zip_code", cityValue);
      } else {
        params.set("city", normalizeCityQuery(cityValue));
      }
      if (beds) params.set("beds", beds);
      if (maxPrice) params.set("max_price", maxPrice);
      setShowDropdown(false);
      setSuggestions([]);
      startTransition(() => {
        router.push(`/listings?${params.toString()}`);
      });
    },
    [beds, maxPrice, router]
  );

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = city.trim();
    if (!q) return;

    // Cancel debounce timer
    if (autoSearchTimer) {
      clearTimeout(autoSearchTimer);
      setAutoSearchTimer(null);
    }

    const params = new URLSearchParams();

    if (isNLQuery(q)) {
      // AI natural language parse
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
        if (!parsed.city) params.set("city", q);
      } catch {
        params.set("city", q);
      } finally {
        setParsing(false);
      }
    } else if (/^\d{5}$/.test(q)) {
      params.set("zip_code", q);
      if (beds) params.set("beds", beds);
      if (maxPrice) params.set("max_price", maxPrice);
    } else {
      params.set("city", normalizeCityQuery(q));
      if (beds) params.set("beds", beds);
      if (maxPrice) params.set("max_price", maxPrice);
    }

    trackEvent(AnalyticsEvents.SEARCH, {
      query: q,
      city: params.get("city") ?? "",
      zip_code: params.get("zip_code") ?? "",
      beds: params.get("beds") ?? "",
      max_price: params.get("max_price") ?? "",
      is_nl_query: isNLQuery(q),
    });
    router.push(`/listings?${params.toString()}`);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          setCity(suggestions[selectedIndex].city);
          navigateToCity(suggestions[selectedIndex].city);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl relative">
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          placeholder='City, ZIP, or try "3br house in Austin under $600k"'
          value={city}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          className="flex-1 h-12 text-base pr-10"
          required
          autoComplete="off"
        />
        {/* AI detection indicator */}
        {city.trim().length > 3 && isNLQuery(city) ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" title="AI will parse this query">
            <Sparkles className="w-4 h-4" />
          </div>
        ) : (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
        )}

        {/* Autocomplete dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.city}-${suggestion.state}`}
                type="button"
                onClick={() => {
                  setCity(suggestion.city);
                  navigateToCity(suggestion.city);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted transition-colors ${
                  index === selectedIndex ? "bg-muted" : ""
                }`}
              >
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{suggestion.displayName}</span>
              </button>
            ))}
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
