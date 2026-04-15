"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "spechouse_compare";
const CACHE_KEY = "spechouse_compare_cache";
const MAX_COMPARE = 4;

function readIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIds(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export type PropertySpec = {
  id: number;
  address: string;
  price: number;
  score?: number;
  // other fields allowed
};

function readCache(): Record<number, PropertySpec> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<number, PropertySpec>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCompare() {
  const [ids, setIds] = useState<number[]>([]);

  // Hydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    setIds(readIds());
    // Sync across tabs
    const onStorage = () => setIds(readIds());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      let next: number[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else if (prev.length >= MAX_COMPARE) {
        return prev; // silently ignore when at max
      } else {
        next = [...prev, id];
      }
      writeIds(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CACHE_KEY);
    setIds([]);
  }, []);

  const isSelected = (id: number) => ids.includes(id);
  const canAdd = (id: number) => !ids.includes(id) && ids.length < MAX_COMPARE;

  const getProperty = useCallback((id: number): PropertySpec | undefined => {
    const cache = readCache();
    return cache[id];
  }, []);

  const cacheProperties = useCallback((properties: PropertySpec[]) => {
    const cache = readCache();
    for (const prop of properties) {
      cache[prop.id] = prop;
    }
    writeCache(cache);
  }, []);

  return { ids, toggle, clear, isSelected, canAdd, getProperty, cacheProperties };
}

// ── Context ───────────────────────────────────────────────────────────────────

type CompareContextValue = ReturnType<typeof useCompare>;

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const value = useCompare();
  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompareContext(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompareContext must be used within CompareProvider");
  return ctx;
}