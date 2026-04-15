"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export default function ShareButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (typeof window !== "undefined") {
          navigator.clipboard.writeText(window.location.href);
        }
      }}
      className="cursor-pointer"
    >
      <Share2 className="w-3.5 h-3.5 mr-1" />
      Share
    </Button>
  );
}