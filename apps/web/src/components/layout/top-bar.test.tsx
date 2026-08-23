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

  it("Escape closes the account menu and returns focus to the trigger", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TopBar />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("arrow keys move focus through the open menu's items with wrap-around", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "About" })).toHaveFocus(); // P4: /about link
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
  });

  it("ArrowUp on a freshly opened menu focuses the last item", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
  });

  it("marks the account trigger as a menu popup", () => {
    render(<TopBar />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveAttribute("aria-haspopup", "menu");
  });
});
