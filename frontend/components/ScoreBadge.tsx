"use client";

import { scoreColor } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  score: number | undefined;
  label?: string;
  size?: "sm" | "md";
}

export default function ScoreBadge({ score, label, size = "md" }: Props) {
  const colorClass = scoreColor(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        colorClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      {score != null ? score.toFixed(1) : "—"}
      {label && <span className="font-normal opacity-75">{label}</span>}
    </span>
  );
}
