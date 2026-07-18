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
});
