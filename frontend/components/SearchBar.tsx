"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Props {
  defaultCity?: string;
  defaultBeds?: string;
  defaultMaxPrice?: string;
}

export default function SearchBar({ defaultCity = "", defaultBeds = "", defaultMaxPrice = "" }: Props) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [beds, setBeds] = useState(defaultBeds);
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    const params = new URLSearchParams();
    params.set("city", city.trim());
    if (beds) params.set("beds", beds);
    if (maxPrice) params.set("max_price", maxPrice);
    router.push(`/listings?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
      <Input
        placeholder="City, e.g. Austin TX"
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
      <Button type="submit" size="lg" className="h-12 px-6">
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
    </form>
  );
}
