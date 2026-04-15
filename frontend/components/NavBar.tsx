"use client";

import Link from "next/link";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart } from "lucide-react";

export default function NavBar() {
  const { favorites } = useFavorites();
  const count = favorites.length;

  return (
    <nav className="w-full border-b bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-black text-xl">
          Spec<span className="text-primary">House</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/saved"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Heart className="w-4 h-4" />
            Saved
            {count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-xs font-semibold rounded-full bg-primary text-primary-foreground px-1.5">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}