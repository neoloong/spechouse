"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "spechouse_compare";
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
    setIds([]);
  }, []);

  const isSelected = (id: number) => ids.includes(id);
  const canAdd = (id: number) => !ids.includes(id) && ids.length < MAX_COMPARE;

  return { ids, toggle, clear, isSelected, canAdd };
}
