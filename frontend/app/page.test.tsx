import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

vi.mock("@/components/SearchBar", () => ({
  default: () => <input data-testid="search-bar" />,
}));

vi.mock("@/components/ScoreBadge", () => ({
  default: ({ label }: { label?: string }) => <span data-testid="score-badge">{label}</span>,
}));

describe("HomePage", () => {
  it("renders the hero headline", () => {
    render(<HomePage />);
    expect(screen.getByText(/Which property is/i)).toBeInTheDocument();
  });

  it("renders the hero subheadline", () => {
    render(<HomePage />);
    expect(screen.getByText(/Compare any 2–4 properties/i)).toBeInTheDocument();
  });

  it("renders the search bar", () => {
    render(<HomePage />);
    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
  });

  it("renders the example comparison section", () => {
    render(<HomePage />);
    expect(screen.getByText(/See how it works/i)).toBeInTheDocument();
  });

  it("renders the two example property addresses", () => {
    render(<HomePage />);
    expect(screen.getByText("742 Evergreen")).toBeInTheDocument();
    expect(screen.getByText("1640 Riverside")).toBeInTheDocument();
  });

  it("renders a 'See full comparison' link to /compare", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /see full comparison/i });
    expect(link).toHaveAttribute("href", "/compare?ids=1,2");
  });

  it("renders score badges in hero", () => {
    render(<HomePage />);
    const badges = screen.getAllByTestId("score-badge");
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the feature bullets section", () => {
    render(<HomePage />);
    expect(screen.getByText("Spec Comparison")).toBeInTheDocument();
    expect(screen.getByText("Noise & Crime")).toBeInTheDocument();
    expect(screen.getByText("Investment Scores")).toBeInTheDocument();
  });
});