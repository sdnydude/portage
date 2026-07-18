import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AuthProvider } from "./auth-provider";

function sessionResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      token: "exchanged-token",
      user: { id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user", onboardingCompleted: true },
      ...overrides,
    }),
  };
}

describe("AuthProvider (Cloudflare Access)", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "http://localhost/inventory" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the loading spinner (not a logged-out state) while the cold-load exchange is in flight", async () => {
    // Live 2026-07-10: with no cached token, isReady flipped true before the
    // exchange resolved, so /home flashed the logged-out "Welcome to Portage"
    // hero at every cold load. With nothing cached, children must not render
    // until the exchange settles.
    let resolveExchange!: (v: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise((res) => { resolveExchange = res; }));
    vi.stubGlobal("fetch", fetchMock);

    const { useAuth } = await import("@/hooks/use-auth");
    function WhoAmI() {
      const { user, isAuthenticated } = useAuth();
      return <div>{isAuthenticated ? `hi ${user?.email}` : "anon"}</div>;
    }

    const { queryByText, findByText } = render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>,
    );

    // Exchange pending, no cache: neither authed nor anon content may render.
    expect(queryByText("anon")).toBeNull();
    expect(queryByText(/hi /)).toBeNull();

    await act(async () => {
      resolveExchange(sessionResponse());
    });
    expect(await findByText("hi e@x.com")).toBeDefined();
  });

  it("exchanges the CF session on mount and exposes the user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { useAuth } = await import("@/hooks/use-auth");
    function WhoAmI() {
      const { user, isAuthenticated } = useAuth();
      return <div>{isAuthenticated ? `hi ${user?.email}` : "anon"}</div>;
    }

    const { findByText } = render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>,
    );

    expect(await findByText("hi e@x.com")).toBeDefined();
    const exchangeCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/auth/session"));
    expect(exchangeCall).toBeDefined();
    expect(localStorage.getItem("portage_token")).toBe("exchanged-token");
  });

  it("fires orders sync + GTC sweep once per browser session after the first exchange", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<AuthProvider><div>a</div></AuthProvider>);
    await act(async () => {});
    first.unmount();

    const syncCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/orders/sync"));
    const sweepCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/listings/gtc-sweep"));
    expect(syncCalls().length).toBe(1);
    expect(sweepCalls().length).toBe(1);
    expect(syncCalls()[0][1].headers.Authorization).toBe("Bearer exchanged-token");
    // keepalive lets the request survive an immediate navigation
    expect(syncCalls()[0][1].keepalive).toBe(true);

    // Second mount in the same browser session (e.g. reload) must not re-fire
    render(<AuthProvider><div>b</div></AuthProvider>);
    await act(async () => {});
    expect(syncCalls().length).toBe(1);
    expect(sweepCalls().length).toBe(1);
  });

  it("logout clears local state and redirects to the Cloudflare Access logout URL", async () => {
    localStorage.setItem("portage_token", "t");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));

    const { useAuth } = await import("@/hooks/use-auth");
    function LogoutButton() {
      const { logout } = useAuth();
      return <button onClick={() => logout()}>out</button>;
    }

    const { getByText } = render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>,
    );

    await act(async () => {
      getByText("out").click();
    });

    expect(localStorage.getItem("portage_token")).toBeNull();
    expect(localStorage.getItem("portage_user")).toBeNull();
    expect(window.location.href).toContain(".cloudflareaccess.com/cdn-cgi/access/logout");
  });

  it("redirects to /home the moment auth:session-lost fires", async () => {
    localStorage.setItem("portage_token", "t");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse()));

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent("auth:session-lost"));
    });

    expect(window.location.href).toBe("/home");
  });
});
