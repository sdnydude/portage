import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";

describe("api session loss", () => {
  beforeEach(() => {
    localStorage.setItem("portage_token", "stale-token");
    localStorage.setItem("portage_refresh", "stale-refresh");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1" }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("dispatches auth:session-lost when the refresh attempt fails", async () => {
    const handler = vi.fn();
    window.addEventListener("auth:session-lost", handler);

    vi.stubGlobal("fetch", vi.fn()
      // original request: 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      })
      // refresh attempt: 401 — session revoked
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Refresh token has been revoked", code: "INVALID_REFRESH_TOKEN" }),
      }));

    await expect(api("/items", { token: "stale-token" })).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:session-lost", handler);
  });

  it("dispatches auth:session-lost when no refresh token exists at all (no zombie state)", async () => {
    localStorage.removeItem("portage_refresh");
    const handler = vi.fn();
    window.addEventListener("auth:session-lost", handler);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
    }));

    await expect(api("/items", { token: "stale-token" })).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("portage_token")).toBeNull();
    window.removeEventListener("auth:session-lost", handler);
  });

  it("does NOT wipe the session or dispatch when the refresh endpoint 500s (server hiccup, not auth loss)", async () => {
    const handler = vi.fn();
    window.addEventListener("auth:session-lost", handler);

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal error", code: "INTERNAL" }),
      }));

    await expect(api("/items", { token: "stale-token" })).rejects.toThrow();

    expect(handler).not.toHaveBeenCalled();
    expect(localStorage.getItem("portage_refresh")).toBe("stale-refresh");
    window.removeEventListener("auth:session-lost", handler);
  });
});
