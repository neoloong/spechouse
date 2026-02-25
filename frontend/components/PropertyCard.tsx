"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ScoreBadge from "@/components/ScoreBadge";
import { fmt, type PropertyListItem } from "@/lib/api";
import { Plus, Check } from "lucide-react";

interface Props {
  property: PropertyListItem;
  compareIds: number[];
  onToggleCompare: (id: number) => void;
}

export default function PropertyCard({ property: p, compareIds, onToggleCompare }: Props) {
  const isInCompare = compareIds.includes(p.id);
  const scores = p.agg_data?.scores;
  const rental = p.agg_data?.rental;
  const env = p.agg_data?.environment;

  return (
    <Card className="hover:shadow-md transition-shadow group overflow-hidden">
      {/* Photo */}
      <Link href={`/property/${p.id}`}>
        <div className="relative w-full h-44 bg-muted overflow-hidden">
          {p.photo_url ? (
            <img
              src={p.photo_url}
              alt={p.address_display}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              🏠 No photo
            </div>
          )}
          <div className="absolute top-2 right-2">
            <ScoreBadge score={scores?.overall} size="sm" />
          </div>
        </div>
      </Link>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link href={`/property/${p.id}`} className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
              {p.address_display}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[p.city, p.state].filter(Boolean).join(", ")}
            </p>
          </Link>
        </div>

        {/* Price */}
        <p className="text-xl font-bold mt-1">{fmt(p.list_price, "currency")}</p>

        {/* Specs row */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
          {p.beds != null && <span>{p.beds} bd</span>}
          {p.baths != null && <span>{p.baths} ba</span>}
          {p.sqft != null && <span>{p.sqft.toLocaleString()} sqft</span>}
          {p.property_type && (
            <Badge variant="outline" className="text-xs py-0">
              {p.property_type}
            </Badge>
          )}
        </div>

        {/* Enrichment signals */}
        {(rental?.estimate || env?.noise_label) && (
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            {rental?.estimate && (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                Rent ~{fmt(rental.estimate, "currency")}/mo
              </span>
            )}
            {rental?.yield_pct && (
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                {rental.yield_pct.toFixed(1)}% yield
              </span>
            )}
            {env?.noise_label && (
              <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                🔊 {env.noise_label}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Link href={`/property/${p.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View details
            </Button>
          </Link>
          <Button
            size="sm"
            variant={isInCompare ? "default" : "outline"}
            onClick={() => onToggleCompare(p.id)}
            disabled={!isInCompare && compareIds.length >= 4}
            className="shrink-0"
          >
            {isInCompare ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
