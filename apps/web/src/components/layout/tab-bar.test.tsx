import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TabBar } from "./tab-bar";

const mockPathname = vi.fn(() => "/home");
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

// Stub ScanFlow: a close button that reports a draft-fallback warning,
// the way Save & List does when eBay rejects the publish.
vi.mock("@/components/capture/scan-flow", () => ({
  ScanFlow: ({ onClose }: { onClose: (r?: { warning?: string }) => void }) => (
    <button onClick={() => onClose({ warning: "Listing created as draft — publish to eBay failed: account locked" })}>
      close-scan-with-warning
    </button>
  ),
}));

beforeEach(() => {
  mockPathname.mockReturnValue("/home");
});

describe("TabBar", () => {
  it("renders exactly 5 tabs — More is not in the bar", () => {
    render(<TabBar />);
    for (const name of ["Home", "Inventory", "Listings", "Porter", "Orders"])
      expect(screen.getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /More/ })).not.toBeInTheDocument();
  });

  it("floats inset with rounded glass styling and hides at lg", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("rounded-[22px]");
    expect(nav.className).toContain("lg:hidden");
    expect(nav.className).not.toContain("bottom-0 left-0 right-0");
  });

  it("renders compact (icon-only, no visible labels) on non-tab routes", () => {
    mockPathname.mockReturnValue("/settings/help");
    render(<TabBar />);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("minimizes on scroll-down past threshold on tab pages, restores on scroll-up", () => {
    render(<TabBar />); // mockPathname is "/home" via beforeEach — a tab route
    expect(screen.getByText("Home")).toBeInTheDocument();
    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    fireEvent.scroll(window);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    fireEvent.scroll(window);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("uses a fade transition (not translate/scale) under prefers-reduced-motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<TabBar />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("transition-opacity");
    expect(nav.className).not.toContain("transition-all");
    vi.unstubAllGlobals();
  });

  it("resets to full state on tab-to-tab navigation while minimized", () => {
    const { rerender } = render(<TabBar />); // "/home" via beforeEach — a tab route
    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    fireEvent.scroll(window);
    expect(screen.queryByText("Home")).not.toBeInTheDocument(); // minimized
    mockPathname.mockReturnValue("/inventory");
    rerender(<TabBar />);
    // "(re-)entering a tab route always starts full" — labels visible again
    expect(screen.getByText("Home")).toBeInTheDocument();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("fade gradient bottom tracks the compact bar height", () => {
    mockPathname.mockReturnValue("/settings/help"); // non-tab route — permanent compact (48px bar)
    const { container } = render(<TabBar />);
    const gradient = container.querySelector("div.pointer-events-none") as HTMLElement;
    expect(gradient.style.bottom).toContain("3.5rem"); // 48px bar + 8px lift; full state is 4.5rem
  });
});

describe("TabBar scan warning toast", () => {
  it("surfaces the Save & List draft-fallback warning after ScanFlow closes", async () => {
    render(<TabBar />);

    fireEvent.click(screen.getByRole("button", { name: "Scan item" }));
    fireEvent.click(screen.getByText("close-scan-with-warning"));

    expect(await screen.findByRole("status")).toHaveTextContent(/account locked/);
  });

  it("keeps the publish-failure banner until the user dismisses it (no 8s auto-hide)", () => {
    vi.useFakeTimers();
    try {
      render(<TabBar />);
      fireEvent.click(screen.getByRole("button", { name: "Scan item" }));
      fireEvent.click(screen.getByText("close-scan-with-warning"));
      // Past the old 8s auto-dismiss window — must still be visible.
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByRole("status")).toHaveTextContent(/account locked/);
      // Only an explicit dismiss clears it.
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
