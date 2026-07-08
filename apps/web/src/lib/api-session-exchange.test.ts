import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./api";

describe("api CF session exchange", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("re-exchanges the CF session on 401 and retries with the new token", async () => {
    const fetchMock = vi.fn()
      // original request: 401 (internal token expired)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      })
      // GET /auth/session — CF cookie still valid, fresh internal token
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "fresh-token", user: { id: "u1", email: "t@example.com" } }),
      })
      // retried original request
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ items: unknown[] }>("/items", { token: "stale-token" });

    expect(result).toEqual({ items: [] });
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/session");
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer fresh-token");
    expect(localStorage.getItem("portage_token")).toBe("fresh-token");
  });
});
