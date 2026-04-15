import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFavorites } from "./useFavorites";

const STORAGE_KEY = "spechouse_favorites";

function getStored(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function setStored(value: string | null): void {
  if (value === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, value);
}

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("adds a property id", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add(42));
    expect(result.current.favorites).toContain(42);
    expect(getStored()).toBe("[42]");
  });

  it("removes a property id", () => {
    setStored("[1,2,3]");
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.remove(2));
    expect(result.current.favorites).toEqual([1, 3]);
    expect(getStored()).toBe("[1,3]");
  });

  it("toggles a property id on", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle(5));
    expect(result.current.favorites).toContain(5);
    act(() => result.current.toggle(7));
    expect(result.current.favorites).toContain(7);
  });

  it("toggles a property id off", () => {
    setStored("[5,7]");
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle(5));
    expect(result.current.favorites).not.toContain(5);
    expect(result.current.favorites).toEqual([7]);
  });

  it("isFavorite returns true for added id", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add(99));
    expect(result.current.isFavorite(99)).toBe(true);
  });

  it("isFavorite returns false for non-added id", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite(1)).toBe(false);
  });

  it("getAll returns a copy of favorites", () => {
    setStored("[10,20]");
    const { result } = renderHook(() => useFavorites());
    const all = result.current.getAll();
    expect(all).toEqual([10, 20]);
    // Mutating the returned array should not affect the hook's state
    all.push(999);
    expect(result.current.favorites).toEqual([10, 20]);
  });

  it("persists to localStorage on add/remove/toggle", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add(1));
    act(() => result.current.add(2));
    expect(getStored()).toBe("[1,2]");
    act(() => result.current.remove(1));
    expect(getStored()).toBe("[2]");
    act(() => result.current.toggle(2));
    expect(getStored()).toBe("[]");
  });

  it("does not add duplicate ids", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add(5));
    act(() => result.current.add(5));
    expect(result.current.favorites.filter((id) => id === 5)).toHaveLength(1);
  });
});