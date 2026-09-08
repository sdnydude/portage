import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "stephen@x.com" } }),
}));

vi.mock("@/hooks/use-messages", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));

describe("PageHeader avatar", () => {
  it("shows a Settings avatar link to /more when showAvatar is set", () => {
    render(<PageHeader title="Inventory" showAvatar />);
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("href", "/more");
    expect(link).toHaveTextContent("S");
  });

  it("always renders the theme toggle and avatar, even without showAvatar", () => {
    render(<PageHeader title="Orders" />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
