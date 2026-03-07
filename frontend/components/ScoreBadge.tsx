import { scoreColor } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  score: number | undefined;
  label?: string;
  size?: "sm" | "md";
}

export default function ScoreBadge({ score, label, size = "md" }: Props) {
  // Normalize from 0-100 to 0-10
  const normalizedScore = score != null ? score / 10 : undefined;
  const colorClass = scoreColor(normalizedScore);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        colorClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      {normalizedScore != null ? normalizedScore.toFixed(1) : "—"}
      {label && <span className="font-normal opacity-75">{label}</span>}
    </span>
  );
}
