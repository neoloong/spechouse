"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCompareContext as useCompare, type PropertySpec } from "@/hooks/useCompare";
import { Button } from "@/components/ui/button";
import ScoreBadge from "@/components/ScoreBadge";
import { GitCompareArrows, X, Plus, ChevronUp } from "lucide-react";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function CompareTray() {
  const { ids, toggle, clear, getProperty } = useCompare();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get property data for each id
  const properties: PropertySpec[] = ids.map((id) => {
    const prop = getProperty(id);
    return prop ?? { id, address: `#${id}`, price: 0 };
  });

  const ready = ids.length >= 2;
  const fromUrl = encodeURIComponent(pathname);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleCompareNow = useCallback(() => {
    trackEvent(AnalyticsEvents.COMPARE_OPEN, { property_ids: ids.join(",") });
    router.push(`/compare?ids=${ids.join(",")}&from=${fromUrl}`);
    setOpen(false);
  }, [ids, fromUrl, router]);

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      {/* Dropdown appears above the tray pill */}
      {open && (
        <div
          ref={dropdownRef}
          className="mb-3 w-80 bg-background border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">
              {ids.length} property{ids.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close dropdown"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Property list */}
          <div className="max-h-64 overflow-y-auto divide-y">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prop.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {prop.price > 0 ? `$${prop.price.toLocaleString()}` : "—"}
                  </p>
                </div>
                {prop.score != null && (
                  <ScoreBadge score={prop.score} size="sm" />
                )}
                <button
                  type="button"
                  onClick={() => toggle(prop.id)}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${prop.address}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30">
            {ready ? (
              <Button size="sm" className="flex-1" onClick={handleCompareNow}>
                <GitCompareArrows className="w-4 h-4 mr-1.5" />
                Compare now
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  router.push("/listings");
                  setOpen(false);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add more
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Tray pill — split into two zones */}
      <div
        className={cn(
          "flex items-center gap-3 bg-background border shadow-2xl rounded-full px-1 py-1 transition-all",
          open ? "ring-2 ring-primary/30" : "hover:shadow-3xl"
        )}
      >
        {/* Left: property count → toggle dropdown */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 pl-3 pr-4 py-2 cursor-pointer"
          aria-label={`${ids.length} properties selected — click to view`}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {ids.length}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {ids.length === 1 ? "1 property" : `${ids.length} properties`}
          </span>
        </button>

        {/* Divider */}
        <span className="text-muted-foreground/30 select-none">|</span>

        {/* Right: compare action */}
        {ready ? (
          <button
            type="button"
            onClick={handleCompareNow}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
            aria-label="Compare properties"
          >
            <GitCompareArrows className="w-4 h-4" />
            Compare
          </button>
        ) : (
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Need {2 - ids.length} more
          </span>
        )}
      </div>
    </div>
  );
}