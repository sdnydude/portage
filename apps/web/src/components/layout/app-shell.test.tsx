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
// AppShell tests cover shell structure only — desktop chrome children are
// mocked so their hooks (auth, messages, router) never mount here.
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@/components/layout/top-bar", () => ({
  TopBar: () => <div data-testid="top-bar" />,
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

  it("mounts the tab bar on tab routes too (unified ownership — AppShell owns TabBar on every non-admin route)", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });

  it("renders shell-main and the reserved dock slot on app routes", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("shell-main")).toContainElement(screen.getByTestId("page"));
    expect(screen.getByTestId("dock-slot")).toBeInTheDocument();
  });
});
