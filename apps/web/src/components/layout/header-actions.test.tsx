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
});
