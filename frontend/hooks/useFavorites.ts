"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "spechouse_favorites";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function readFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeFavorites(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// ─── Snapshot stores (no-op on server) ────────────────────────────────────────

const noop = () => "";
const emptySubscribe = (_onStoreChange: () => void) => () => {};
const emptyGetSnapshot = () => undefined;

// ─── useFavorites ─────────────────────────────────────────────────────────────

export function useFavorites() {
  // Use useSyncExternalStore for automatic cross-tab sync
  const [favorites, setFavorites] = useState<number[]>(() => readFavorites());

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavorites(readFavorites());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((id: number) => {
    setFavorites((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeFavorites(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = prev.filter((x) => x !== id);
      writeFavorites(next);
      return next;
    });
  }, []);

  const toggle = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: number) => favorites.includes(id),
    [favorites]
  );

  const getAll = useCallback(() => [...favorites], [favorites]);

  return { favorites, add, remove, toggle, isFavorite, getAll };
}