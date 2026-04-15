"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ScoreBreakdownItem {
  label: string;
  value: string;
  score?: number;
}

export interface ScoreDisplayProps {
  score: number; // 0-100
  label: string; // "Value" | "Investment" | "Environment"
  confidence?: number; // ± value, e.g. 8
  breakdown?: ScoreBreakdownItem[];
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * Reusable score display component.
 *
 * Shows a circular progress indicator with color coding and optional confidence
 * interval. Can expand to show a breakdown of factors contributing to the score.
 */
export default function ScoreDisplay({
  score,
  label,
  confidence,
  breakdown,
  size = "md",
  showLabel = true,
}: ScoreDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  // ── Color coding ──────────────────────────────────────────────────────────
  const colorClass =
    score >= 70 ? "text-emerald-600" :
    score >= 50 ? "text-yellow-600" :
    "text-red-600";

  const trackClass =
    score >= 70 ? "stroke-emerald-200" :
    score >= 50 ? "stroke-yellow-200" :
    "stroke-red-200";

  const fillClass =
    score >= 70 ? "stroke-emerald-500" :
    score >= 50 ? "stroke-yellow-500" :
    "stroke-red-500";

  // ── Size mapping ──────────────────────────────────────────────────────────
  const sizeMap = {
    sm: { size: 48, stroke: 4, labelSize: "text-xs", fontSize: "text-sm" },
    md: { size: 72, stroke: 5, labelSize: "text-sm", fontSize: "text-base" },
    lg: { size: 96, stroke: 6, labelSize: "text-base", fontSize: "text-xl" },
  };
  const { size: svgSize, stroke, labelSize, fontSize } = sizeMap[size];

  // ── Circular progress ──────────────────────────────────────────────────────
  const radius = (svgSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  // Normalize score to 0-10 for display
  const displayScore = (score / 10).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Circular progress + score */}
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className={cn("transition-all", trackClass)}
          />
          {/* Fill */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn("transition-all", fillClass)}
          />
        </svg>

        {/* Score text */}
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center", colorClass)}>
          <span className={cn("font-bold leading-none", fontSize)}>{displayScore}</span>
          {confidence != null && (
            <span className="text-xs font-normal opacity-60">±{confidence}</span>
          )}
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <span className={cn("text-muted-foreground font-medium", labelSize)}>
          {label}
        </span>
      )}

      {/* Expandable breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div className="w-full">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 underline"
          >
            {expanded ? "Hide" : "Why this score?"}
          </button>

          {expanded && (
            <div className="mt-2 rounded-lg border bg-card p-3 text-xs space-y-1.5">
              {breakdown.map((item, i) => (
                <div key={i} className="flex justify-between items-center gap-4">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={cn("font-medium", item.score != null ? scoreColor(item.score) : "")}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}