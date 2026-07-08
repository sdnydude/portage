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
});
