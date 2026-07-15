import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./top-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 2 }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "s@x.com" }, logout: vi.fn() }),
}));

describe("TopBar", () => {
  it("renders the current page title", () => {
    render(<TopBar />);
    expect(screen.getByRole("heading", { name: "Inventory" })).toBeInTheDocument();
  });

  it("links to messages with an unread indicator", () => {
    render(<TopBar />);
    expect(screen.getByRole("link", { name: /Messages, 2 unread/ })).toHaveAttribute("href", "/messages");
  });

  it("opens the account menu with profile, settings, log out", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });
});
