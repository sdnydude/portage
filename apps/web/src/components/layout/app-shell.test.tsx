import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

const mockPathname = vi.fn(() => "/admin/users");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));
vi.mock("@/components/layout/tab-bar", () => ({
  TabBar: () => <nav data-testid="tab-bar" />,
}));

describe("AppShell", () => {
  it("passes the admin tree through with no shell chrome", () => {
    mockPathname.mockReturnValue("/admin/users");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-main")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tab-bar")).not.toBeInTheDocument();
  });

  it("renders the tab bar on non-tab routes (compact-state mounting)", () => {
    mockPathname.mockReturnValue("/settings/help");
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });

  it("does not mount the tab bar on tab routes (layout owns it until unification)", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div /></AppShell>);
    expect(screen.queryByTestId("tab-bar")).not.toBeInTheDocument();
  });

  it("renders shell-main and the reserved dock slot on app routes", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("shell-main")).toContainElement(screen.getByTestId("page"));
    expect(screen.getByTestId("dock-slot")).toBeInTheDocument();
  });
});
