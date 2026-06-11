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
