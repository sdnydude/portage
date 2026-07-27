import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, apiUpload, _resetExchangeBreakerForTests } from "./api";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  _resetExchangeBreakerForTests();
  localStorage.clear();
});

describe("api() network-failure recovery (CF Access session expiry)", () => {
  it("a fetch TypeError triggers one session re-exchange and the retried request succeeds", async () => {
    const fetchMock = vi
      .fn()
      // Original request: CF edge 302→login page, browser kills it cross-origin.
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      // exchangeSession(): CF cookie still valid → fresh internal token.
      .mockResolvedValueOnce(ok({ token: "fresh-token", user: { id: "u1" } }))
      // Retried request with the fresh token.
      .mockResolvedValueOnce(ok({ id: "item-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ id: string }>("/items/item-1", { token: "stale" });
    expect(result).toEqual({ id: "item-1" });
    const lastHeaders = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(lastHeaders.Authorization).toBe("Bearer fresh-token");
  });

  it("apiUpload recovers the same way (FormData is safe to resend)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok({ token: "fresh-token", user: { id: "u1" } }))
      .mockResolvedValueOnce(ok({ image: { url: "u", key: "k" } }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    const result = await apiUpload<{ image: { key: string } }>("/images", form, { token: "stale" });
    expect(result.image.key).toBe("k");
  });

  it("when recovery also fails, throws an actionable message instead of raw 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/items", { token: "t" })).rejects.toMatchObject({
      code: "NETWORK",
      message: expect.stringMatching(/reload the page|check your connection/i),
    });
  });
});
