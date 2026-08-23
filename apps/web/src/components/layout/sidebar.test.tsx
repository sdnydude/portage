import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";
import { useUnreadCount } from "@/hooks/use-messages";

vi.mock("next/navigation", () => ({ usePathname: () => "/inventory" }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: vi.fn(() => ({ count: 0 })) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn(() => ({ user: { email: "s@x.com", role: "user" } })) }));
vi.mock("@/components/capture/scan-flow", () => ({
  ScanFlow: () => <div data-testid="scan-flow" />,
}));

describe("Sidebar", () => {
  it("renders 4 main tabs, Messages + Settings + About secondary items, and Scan — Listings is not in the nav", () => {
    render(<Sidebar />);
    for (const name of ["Home", "Inventory", "Porter", "Orders", "Messages", "Settings", "About"])
      expect(screen.getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Listings/ })).not.toBeInTheDocument();
    // every secondary item renders an icon — /about must not fall through NavIcon's default
    expect(screen.getByRole("link", { name: /About/ }).querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan/i })).toBeInTheDocument();
  });

  it("collapse toggle flips width class and persists to localStorage", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toContain("w-60");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(nav.className).toContain("w-[72px]");
    expect(localStorage.getItem("portage_sidebar_collapsed")).toBe("1");
  });

  it("shows the unread dot on Messages when count > 0", () => {
    vi.mocked(useUnreadCount).mockReturnValue({ count: 3 } as ReturnType<typeof useUnreadCount>);
    render(<Sidebar />);
    const messages = screen.getByRole("link", { name: /Messages/ });
    expect(messages.querySelector("span.bg-\\[var\\(--orange\\)\\]")).not.toBeNull();
  });

  it("mounts ScanFlow outside the sticky nav (sticky traps fixed overlays)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "Scan item" }));
    const scanFlow = screen.getByTestId("scan-flow");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.contains(scanFlow)).toBe(false);
  });
});
