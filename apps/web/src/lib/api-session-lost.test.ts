import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";

describe("api session loss", () => {
  beforeEach(() => {
    localStorage.setItem("portage_token", "stale-token");
    localStorage.setItem("portage_user", JSON.stringify({ id: "u1" }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("dispatches auth:session-lost when the CF session exchange is rejected", async () => {
    const handler = vi.fn();
    window.addEventListener("auth:session-lost", handler);

    vi.stubGlobal("fetch", vi.fn()
      // original request: 401 (internal token expired)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      })
      // session exchange: 401 — CF session gone or user not allowed
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Cloudflare Access authentication required", code: "CF_REQUIRED" }),
      }));

    await expect(api("/items", { token: "stale-token" })).rejects.toThrow();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("portage_token")).toBeNull();
    window.removeEventListener("auth:session-lost", handler);
  });

  it("does NOT wipe the session or dispatch when the exchange endpoint 500s (server hiccup, not auth loss)", async () => {
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
    expect(localStorage.getItem("portage_token")).toBe("stale-token");
    window.removeEventListener("auth:session-lost", handler);
  });
});
