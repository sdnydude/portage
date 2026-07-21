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
// PorterDock consumes Porter + current-item contexts; mock it so AppShell
// structure tests stay context-free (it renders the dock-slot aside).
vi.mock("@/components/porter/porter-dock", () => ({
  PorterDock: () => <aside data-testid="dock-slot" />,
}));

describe("AppShell", () => {
  it("mounts the shell on admin routes too — no admin carve-out", () => {
    mockPathname.mockReturnValue("/admin/users");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("shell-main")).toContainElement(screen.getByTestId("page"));
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
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

  it("makes the TopBar wrapper sticky — the bar's own sticky is a no-op inside a wrapper exactly its height", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div /></AppShell>);
    const wrapper = screen.getByTestId("top-bar").parentElement as HTMLElement;
    expect(wrapper.className).toContain("sticky");
    expect(wrapper.className).toContain("top-0");
    expect(wrapper.className).toContain("z-40");
  });

  it("renders shell-main and the reserved dock slot on app routes", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("shell-main")).toContainElement(screen.getByTestId("page"));
    expect(screen.getByTestId("dock-slot")).toBeInTheDocument();
  });
});
