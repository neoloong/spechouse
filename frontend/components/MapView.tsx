"use client";

import { useEffect, useRef } from "react";
import type { PropertyListItem } from "@/lib/api";

interface Props {
  properties: PropertyListItem[];
  onMarkerClick?: (id: number) => void;
}

export default function MapView({ properties, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import to avoid SSR issues
    import("maplibre-gl").then((maplibre) => {
      if (!containerRef.current || mapRef.current) return;

      // Find center from properties
      const withCoords = properties.filter((p) => p.latitude && p.longitude);
      const centerLng =
        withCoords.length > 0
          ? withCoords.reduce((s, p) => s + p.longitude!, 0) / withCoords.length
          : -97.7431;
      const centerLat =
        withCoords.length > 0
          ? withCoords.reduce((s, p) => s + p.latitude!, 0) / withCoords.length
          : 30.2672;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [centerLng, centerLat],
        zoom: withCoords.length > 1 ? 10 : 12,
      });

      mapRef.current = map;

      map.on("load", () => {
        withCoords.forEach((p) => {
          const el = document.createElement("div");
          el.className =
            "w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-lg cursor-pointer border-2 border-white";
          el.textContent = p.list_price
            ? p.list_price >= 999_500
              ? `$${(p.list_price / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
              : `$${Math.round(p.list_price / 1000)}k`
            : "•";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";

          const marker = new maplibre.Marker({ element: el })
            .setLngLat([p.longitude!, p.latitude!])
            .addTo(map);

          if (onMarkerClick) {
            el.addEventListener("click", () => onMarkerClick(p.id));
          }
        });
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: 400 }}
    />
  );
}
