"use client";

import React from "react";
import Image from "next/image";

interface PhotoGalleryProps {
  photos?: string[];
  address: string;
}

export default function PhotoGallery({ photos, address }: PhotoGalleryProps) {
  const [active, setActive] = React.useState(0);
  if (!photos || photos.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl overflow-hidden">
      <div className="relative aspect-[16/9] bg-muted">
        <Image
          src={photos[active]}
          alt={`${address} – photo ${active + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setActive((p) => (p - 1 + photos.length) % photos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={() => setActive((p) => (p + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Next photo"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === active ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}