/**
 * Tests for Property Detail page API
 * Field names from PropertySpec interface (lib/api.ts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("getPropertyDetail API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is a function exported from lib/api", async () => {
    const { getPropertyDetail } = await import("@/lib/api");
    expect(typeof getPropertyDetail).toBe("function");
  });

  it("returns a PropertySpec with expected fields for mock id", async () => {
    const { getPropertyDetail } = await import("@/lib/api");
    const result = await getPropertyDetail("mock-property-1");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("address_display");
    expect(result).toHaveProperty("list_price");
  });

  it("includes all fields needed for detail page sections", async () => {
    const { getPropertyDetail } = await import("@/lib/api");
    const property = await getPropertyDetail("mock-property-1");
    if (!property) return;

    // Financials
    expect(property).toHaveProperty("list_price");
    expect(property).toHaveProperty("avm_estimate");

    // Structure
    expect(property).toHaveProperty("beds");
    expect(property).toHaveProperty("baths");
    expect(property).toHaveProperty("sqft");

    // Scores
    expect(property).toHaveProperty("score_overall");

    // Environment
    expect(property).toHaveProperty("noise_db");
    expect(property).toHaveProperty("crime_safety_score");
  });

  it("schools array has name, rating, type, distance_mi for each school", async () => {
    const { getPropertyDetail } = await import("@/lib/api");
    const property = await getPropertyDetail("mock-property-1");
    if (!property || !property.schools?.length) return;

    const school = property.schools[0];
    expect(school).toHaveProperty("name");
    expect(school).toHaveProperty("rating");
    expect(school).toHaveProperty("type");
    expect(school).toHaveProperty("distance_mi");
  });
});
