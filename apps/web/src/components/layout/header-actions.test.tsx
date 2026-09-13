import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderActions } from "./header-actions";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { email: "s@x.com" } }) }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 2 }) }));

describe("HeaderActions", () => {
  it("renders the theme toggle and the avatar link to /more with the unread dot", () => {
    render(<HeaderActions />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings, 2 unread messages" })).toHaveAttribute("href", "/more");
  });

  // Advisor finding 2026-09-13: AppShell renders the desktop TopBar (own theme
  // toggle + avatar) on every page above lg, so page-owned headers must hide
  // this cluster there or desktop shows two of each control.
  it("hides itself at the desktop breakpoint where TopBar already carries the same controls", () => {
    const { container } = render(<HeaderActions />);
    expect(container.firstElementChild).toHaveClass("lg:hidden");
  });
});
