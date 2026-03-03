"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCompare } from "@/hooks/useCompare";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, X, LayoutList } from "lucide-react";

export default function CompareTray() {
  const { ids, clear } = useCompare();
  const router = useRouter();
  const pathname = usePathname();

  if (ids.length === 0) return null;

  const ready = ids.length >= 2;
  const fromUrl = encodeURIComponent(pathname);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-2xl rounded-full px-5 py-2.5">
      <span className="text-sm font-semibold tabular-nums">
        {ids.length} / 4 selected
      </span>

      {ready ? (
        <Button size="sm" onClick={() => router.push(`/compare?ids=${ids.join(",")}&from=${fromUrl}`)}>
          <GitCompareArrows className="w-4 h-4 mr-1.5" />
          Compare now
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => router.push("/listings")}>
          <LayoutList className="w-4 h-4 mr-1.5" />
          Add more
        </Button>
      )}

      <button
        type="button"
        onClick={clear}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Clear compare list"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
