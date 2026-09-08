import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfilePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings/profile",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "t", user: { email: "s@x.com" } }),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({ email: "s@x.com", displayName: null, subscriptionTier: "free", address: null, notificationPreferences: null, createdAt: "2026-01-01" }),
}));

describe("ProfilePage — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
