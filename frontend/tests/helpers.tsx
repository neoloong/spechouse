/**
 * Test helpers for wrapping Next.js components that use useSearchParams.
 * The actual useSearchParams is mocked via vi.mock — this helper provides
 * the Suspense boundary that ComparePage requires.
 */

import React, { createContext, useContext, Suspense } from "react";

interface SearchParamsContextValue {
  searchParams: URLSearchParams;
}

const SearchParamsCtx = createContext<SearchParamsContextValue>(new URLSearchParams());

export function useSearchParamsContext() {
  return useContext(SearchParamsCtx);
}

interface RouteProviderProps {
  component: React.ReactElement;
  searchParams?: URLSearchParams;
}

export function RouteProvider({ component, searchParams = new URLSearchParams() }: RouteProviderProps) {
  return (
    <SearchParamsCtx.Provider value={{ searchParams }}>
      <Suspense fallback={<div>Loading…</div>}>
        {component}
      </Suspense>
    </SearchParamsCtx.Provider>
  );
}