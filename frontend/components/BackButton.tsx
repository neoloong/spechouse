"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back to results
    </button>
  );
}
