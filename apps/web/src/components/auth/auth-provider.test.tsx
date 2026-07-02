import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AuthProvider } from "./auth-provider";

describe("AuthProvider session loss", () => {
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
    vi.restoreAllMocks();
  });

  it("logout calls POST /auth/logout with the refresh token before clearing the session", async () => {
    localStorage.setItem("portage_token", "access-t");
    localStorage.setItem("portage_refresh", "refresh-t");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ loggedOut: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

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

    const logoutCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/auth/logout"));
    expect(logoutCall).toBeDefined();
    expect(JSON.parse(logoutCall![1].body).refreshToken).toBe("refresh-t");
    expect(logoutCall![1].headers.Authorization).toBe("Bearer access-t");
    expect(localStorage.getItem("portage_refresh")).toBeNull();
  });

  it("logout with an expired access token refreshes and retries the revocation (not a silent no-op)", async () => {
    localStorage.setItem("portage_token", "expired-access");
    localStorage.setItem("portage_refresh", "refresh-t");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" }));

    const fetchMock = vi.fn()
      // 1st logout attempt: expired Bearer -> 401
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expired", code: "UNAUTHORIZED" }) })
      // auto-refresh: succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "new-at", refreshToken: "new-rt", user: { id: "u1" } }) })
      // retried logout with fresh token: succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ loggedOut: true }) });
    vi.stubGlobal("fetch", fetchMock);

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

    const logoutCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/logout"));
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/refresh"));
    expect(refreshCalls.length).toBe(1);
    expect(logoutCalls.length).toBe(2);
    expect(logoutCalls[1][1].headers.Authorization).toBe("Bearer new-at");
  });

  it("login fires a fire-and-forget orders sync with the new access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ synced: 0, newOrders: [], errors: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useAuth } = await import("@/hooks/use-auth");
    function LoginButton() {
      const { login } = useAuth();
      return (
        <button onClick={() => login("new-at", "new-rt", { id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" })}>
          in
        </button>
      );
    }

    const { getByText } = render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>,
    );

    await act(async () => {
      getByText("in").click();
    });

    const syncCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/orders/sync"));
    expect(syncCall).toBeDefined();
    expect(syncCall![1].method).toBe("POST");
    expect(syncCall![1].headers.Authorization).toBe("Bearer new-at");
    // keepalive lets the request survive the immediate post-login redirect
    // (router.replace) — without it the navigation cancels the in-flight fetch.
    expect(syncCall![1].keepalive).toBe(true);
  });

  it("redirects to /home the moment auth:session-lost fires", async () => {
    localStorage.setItem("portage_token", "t");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1", email: "e@x.com", subscriptionTier: "pro", role: "user" }));

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
