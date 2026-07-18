import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { AuthContext } from "@/hooks/use-auth";
import { AllowlistSection } from "./allowlist-section";

function renderSection() {
  return render(
    <AuthContext
      value={{
        token: "t",
        user: { id: "u1", email: "admin@x.com", subscriptionTier: "pro", role: "admin" },
        isAuthenticated: true,
        logout: async () => {},
        setOnboardingCompleted: () => {},
      }}
    >
      <AllowlistSection />
    </AuthContext>,
  );
}

describe("AllowlistSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the allowlist emails from GET /admin/allowlist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ emails: ["a@x.com", "b@y.com"] }),
    }));

    const { getByText } = renderSection();

    await waitFor(() => {
      expect(getByText("a@x.com")).toBeDefined();
      expect(getByText("b@y.com")).toBeDefined();
    });
  });

  it("adds an email via POST and shows no Remove button for your own email", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ emails: ["admin@x.com", "new@t.com"] }) };
      }
      return { ok: true, status: 200, json: async () => ({ emails: ["admin@x.com"] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getByLabelText, findByText, queryByText } = renderSection();
    await waitFor(() => expect(getByText("admin@x.com")).toBeDefined());

    const input = getByLabelText("Email to allow") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "new@t.com" } });
    fireEvent.click(getByText("Add"));

    expect(await findByText("new@t.com")).toBeDefined();
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
    expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({ email: "new@t.com" });
    // Own email row shows "you" instead of a Remove button
    expect(getByText("you")).toBeDefined();
    expect(queryByText("Remove")).not.toBeNull();
  });

  it("re-sends an invite via POST when the Resend button is clicked", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ emails: ["admin@x.com", "b@y.com"], invited: true }) };
      }
      return { ok: true, status: 200, json: async () => ({ emails: ["admin@x.com", "b@y.com"] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findAllByText } = renderSection();
    await waitFor(() => expect(getByText("b@y.com")).toBeDefined());

    const resendButtons = await findAllByText("Resend invite");
    fireEvent.click(resendButtons[0]);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({ email: "b@y.com" });
    });
  });
});
