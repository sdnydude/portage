import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NotificationsPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings/notifications",
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ token: "t", user: { email: "s@x.com" } }),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue({ notificationPreferences: null }),
}));

describe("NotificationsPage — header cluster", () => {
  it("carries the theme toggle and user menu", () => {
    render(<NotificationsPage />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
