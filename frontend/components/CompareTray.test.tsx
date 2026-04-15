import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import CompareTray from "./CompareTray";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/listings",
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: { COMPARE_OPEN: "compare_open" },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLocalStorageMock(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => { delete store[k]; }); }),
  };
}

const EMPTY_LS = makeLocalStorageMock({ "spechouse_compare": "[]", "spechouse_compare_cache": "{}" });

function setupLS(initial?: Record<string, string>) {
  const ls = makeLocalStorageMock(initial ?? { "spechouse_compare": "[]", "spechouse_compare_cache": "{}" });
  Object.defineProperty(window, "localStorage", { value: ls, writable: true });
  return ls;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CompareTray component", () => {

  describe("zero items", () => {
    it("renders nothing when 0 items selected", () => {
      setupLS({ "spechouse_compare": "[]", "spechouse_compare_cache": "{}" });
      const { container } = render(<CompareTray />);
      // No pill should appear
      expect(container.firstChild).toBeNull();
    });
  });

  describe("badge visibility", () => {
    it("shows count badge when ≥1 item selected", () => {
      const ls = setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);
      expect(screen.getByText("2 properties")).toBeTruthy();
    });

    it("shows single property label correctly", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);
      expect(screen.getByText("1 property")).toBeTruthy();
    });
  });

  describe("opening dropdown", () => {
    it("clicking the tray pill opens the dropdown", () => {
      setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);

      // Dropdown should not be visible initially
      expect(screen.queryByText("2 properties selected")).toBeNull();

      // Click the tray pill
      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      // Dropdown should now be visible — use function matcher since text is split across spans by React
      const headerSpan = screen.getByText((content) =>
        typeof content === "string" && content.includes("2") && content.includes("selected")
      );
      expect(headerSpan).toBeTruthy();
    });

    it("clicking outside dropdown closes it", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));
      expect(screen.getByText("1 property selected")).toBeTruthy();

      // Click outside
      fireEvent.mouseDown(document.body);
      // Re-render to reflect state update
      render(<CompareTray />);
      expect(screen.queryByText("1 property selected")).toBeNull();
    });

    it("Escape key closes dropdown", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));
      expect(screen.getByText("1 property selected")).toBeTruthy();

      fireEvent.keyDown(document.body, { key: "Escape" });
      render(<CompareTray />);
      expect(screen.queryByText("1 property selected")).toBeNull();
    });
  });

  describe("dropdown content", () => {
    it("dropdown shows all selected properties with address, price, and score", () => {
      setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      expect(screen.getByText("123 Main St")).toBeTruthy();
      expect(screen.getByText("$400,000")).toBeTruthy();
      expect(screen.getByText("456 Oak Ave")).toBeTruthy();
      expect(screen.getByText("$500,000")).toBeTruthy();
    });

    it("each property in dropdown has a remove button", () => {
      setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
      expect(removeButtons).toHaveLength(2);
    });

    it("dropdown shows 'Clear all' link", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));
      expect(screen.getByText("Clear all")).toBeTruthy();
    });
  });

  describe("remove functionality", () => {
    it("clicking remove button on a property removes it from compare list", () => {
      setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      const ls = makeLocalStorageMock({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      Object.defineProperty(window, "localStorage", { value: ls, writable: true });

      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
      // Remove the first property
      fireEvent.click(removeButtons[0]);

      // Should now show only 1 property (ids=[456])
      expect(screen.queryByText("123 Main St")).toBeNull();
      expect(screen.getByText("456 Oak Ave")).toBeTruthy();
    });
  });

  describe("clear all", () => {
    it("clicking 'Clear all' removes all properties", () => {
      setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));
      fireEvent.click(screen.getByText("Clear all"));

      // After clearing, tray should not render (0 items)
      render(<CompareTray />);
      expect(screen.queryByRole("button", { name: /Compare tray/i })).toBeNull();
    });
  });

  describe("compare now navigation", () => {
    it("navigates to compare page with correct URL when ≥2 properties", () => {
      const ls = setupLS({
        "spechouse_compare": "[123, 456]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      // Click "Compare now"
      fireEvent.click(screen.getByRole("button", { name: /Compare now/i }));

      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/compare?ids=123,456")
      );
    });

    it("shows 'Add more' button when <2 properties", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));

      expect(screen.getByRole("button", { name: /Add more/i })).toBeTruthy();
    });

    it("'Add more' button navigates to /listings", () => {
      setupLS({
        "spechouse_compare": "[123]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
        }),
      });
      render(<CompareTray />);

      fireEvent.click(screen.getByRole("button", { name: /Compare tray/i }));
      fireEvent.click(screen.getByRole("button", { name: /Add more/i }));

      expect(mockPush).toHaveBeenCalledWith("/listings");
    });
  });

  describe("state persistence", () => {
    it("tray persists across page navigation (not remounting state)", () => {
      // This is implicitly tested via localStorage sync, but we can
      // verify that useEffect syncs from localStorage on each render.
      const ls = setupLS({
        "spechouse_compare": "[123, 456, 789]",
        "spechouse_compare_cache": JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
          "789": { id: 789, address: "789 Pine Rd", price: 600000, score: 90 },
        }),
      });
      render(<CompareTray />);

      // Initial state should show 3 properties
      expect(screen.getByText("3 properties")).toBeTruthy();

      // Simulate external change to localStorage (e.g., tab sync, another component)
      act(() => {
        ls.setItem("spechouse_compare", "[123, 456, 789, 999]");
        ls.setItem("spechouse_compare_cache", JSON.stringify({
          "123": { id: 123, address: "123 Main St", price: 400000, score: 85 },
          "456": { id: 456, address: "456 Oak Ave", price: 500000, score: 72 },
          "789": { id: 789, address: "789 Pine Rd", price: 600000, score: 90 },
          "999": { id: 999, address: "999 Elm Blvd", price: 700000, score: 80 },
        }));
        // Fire storage event to trigger sync
        window.dispatchEvent(new StorageEvent("storage", {
          key: "spechouse_compare",
          newValue: "[123, 456, 789, 999]",
        }));
      });

      render(<CompareTray />);
      // Strict mode double-renders: use findAll + assert count matches
      const all = screen.getAllByText((content) =>
        typeof content === "string" && content.includes("4") && content.includes("properties")
      );
      // 1 or 2 renders are fine (strict mode), just assert ≥1 real element
      expect(all.length).toBeGreaterThan(0);
      // Verify the text content is correct
      expect(all[0].textContent).toMatch(/4 properties/);
    });
  });
});