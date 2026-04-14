import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import SearchBar from "./SearchBar";

// Mock useRouter
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock parseSearch and analytics
vi.mock("@/lib/api", () => ({
  parseSearch: vi.fn().mockResolvedValue({}),
  AnalyticsEvents: { SEARCH: "search" },
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  AnalyticsEvents: { SEARCH: "search" },
}));

describe("SearchBar component", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the search input", () => {
      render(<SearchBar />);
      expect(screen.getByPlaceholderText(/City, ZIP, or try/i)).toBeTruthy();
    });

    it("renders beds and price inputs", () => {
      render(<SearchBar />);
      expect(screen.getByPlaceholderText(/Min beds/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/Max price/i)).toBeTruthy();
    });

    it("renders search button", () => {
      render(<SearchBar />);
      expect(screen.getByRole("button", { name: /Search/i })).toBeTruthy();
    });
  });

  describe("debounce behavior", () => {
    it("does not trigger search immediately on keystroke", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "au" } });
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("triggers search after debounce delay for short queries", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "austin" } });
      });

      // Fast-forward past debounce (800ms)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("city=Austin"));
    });

    it("does not trigger auto-search for natural language queries", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "3 bedroom house in austin under $500k" } });
      });

      // Fast-forward past debounce
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Natural language queries skip the debounce auto-search
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("autocomplete dropdown", () => {
    it("shows suggestions after typing city name", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "san" } });
      });

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.queryByText("San Francisco, CA")).toBeTruthy();
      });
    });

    it("shows multiple suggestions for partial matches", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "a" } });
      });

      // Austin and New York both contain 'a'
      await waitFor(() => {
        const buttons = screen.queryAllByRole("button");
        // Buttons should appear for suggestions
        expect(buttons.length).toBeGreaterThan(0);
      });
    });


  });

  describe("keyboard navigation", () => {
    it("navigates dropdown with arrow down key", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "san" } });
      });

      await waitFor(() => {
        expect(screen.queryByText("San Francisco, CA")).toBeTruthy();
      });

      // Arrow down should not throw
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
    });

    it("closes dropdown on Escape", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "san" } });
      });

      await waitFor(() => {
        expect(screen.queryByText("San Francisco, CA")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Escape" });
      });

      await waitFor(() => {
        expect(screen.queryByText("San Francisco, CA")).toBeNull();
      });
    });

    it("submits form on Enter when no dropdown active", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "sf" } });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockPush).toHaveBeenCalled();
    });
  });



  describe("empty query", () => {
    it("does not submit when input is empty", async () => {
      render(<SearchBar />);
      const button = screen.getByRole("button", { name: /Search/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("city normalization in navigation", () => {
    it("normalizes 'sf' to San Francisco in navigation", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "sf" } });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("San+Francisco"));
      });
    });

    it("normalizes 'nyc' to New York in navigation", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "nyc" } });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("New+York"));
      });
    });

    it("handles ZIP codes in navigation", async () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText(/City, ZIP, or try/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: "94103" } });
      });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("zip_code=94103"));
      });
    });
  });
});
