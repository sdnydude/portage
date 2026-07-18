import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AuthContext } from "@/hooks/use-auth";
import BetaReportPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("from=%2Finventory"),
}));

describe("BetaReportPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the report form with the page prefilled from ?from= for beta testers", () => {
    const { getByLabelText } = render(
      <AuthContext
        value={{
          token: "t",
          user: { id: "u1", email: "e@x.com", subscriptionTier: "beta-tester", role: "user" },
          isAuthenticated: true,
          logout: async () => {},
          setOnboardingCompleted: () => {},
        }}
      >
        <BetaReportPage />
      </AuthContext>,
    );

    expect((getByLabelText("Where were you?") as HTMLInputElement).value).toBe("/inventory");
    expect(getByLabelText("What happened?")).toBeDefined();
    expect(getByLabelText("Severity")).toBeDefined();
  });

  it("always shows Cancel navigation and a Send button", () => {
    const { getByText } = render(
      <AuthContext
        value={{
          token: "t",
          user: { id: "u1", email: "e@x.com", subscriptionTier: "beta-tester", role: "user" },
          isAuthenticated: true,
          logout: async () => {},
          setOnboardingCompleted: () => {},
        }}
      >
        <BetaReportPage />
      </AuthContext>,
    );

    expect(getByText("Cancel")).toBeDefined();
    expect(getByText("Send report")).toBeDefined();
  });
});
