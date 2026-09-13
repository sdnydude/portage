import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketplacePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings/marketplace",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "t", user: { email: "s@x.com" } }),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({ accounts: [] }),
}));

describe("MarketplacePage — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<MarketplacePage />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
