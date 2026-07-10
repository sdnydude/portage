import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AuthContext } from "@/hooks/use-auth";
import { BetaCta } from "./beta-cta";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
}));

function renderWithTier(tier: "free" | "pro" | "beta-tester") {
  return render(
    <AuthContext
      value={{
        token: "t",
        user: { id: "u1", email: "e@x.com", subscriptionTier: tier, role: "user" },
        isAuthenticated: true,
        logout: async () => {},
        setOnboardingCompleted: () => {},
      }}
    >
      <BetaCta />
    </AuthContext>,
  );
}

describe("BetaCta", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a report link with the current page for beta testers", () => {
    const { getByRole } = renderWithTier("beta-tester");
    const link = getByRole("link");
    expect(link.getAttribute("href")).toBe("/beta/report?from=%2Finventory");
  });

  it("renders nothing for non-beta-tester users", () => {
    const { container } = renderWithTier("pro");
    expect(container.innerHTML).toBe("");
  });

  it("stacks below the full-screen overlay layer (z < 50) so camera/editor overlays cover it", () => {
    // At z-[70] the pill tied with CameraCapture's z-[70] overlay and, as the
    // later <body> sibling, painted over its Done/checkmark button (live bug
    // 2026-07-10). Overlays live at z-50..80; the pill must stay under them.
    const { getByRole } = renderWithTier("beta-tester");
    const cls = getByRole("link").className;
    const z = cls.match(/z-\[?(\d+)\]?/);
    expect(z).not.toBeNull();
    expect(Number(z![1])).toBeLessThan(50);
  });

  it("floats above the tab bar, NOT over the page-header action slot", () => {
    // Top-right placement sat exactly on PageHeader's action button (e.g. the
    // orders Sync button) on every page — the pill must anchor bottom-right,
    // clear of the 64px tab bar.
    const { getByRole } = renderWithTier("beta-tester");
    const cls = getByRole("link").className;
    expect(cls).toMatch(/bottom-\[/);
    expect(cls).not.toMatch(/top-\[/);
  });
});
