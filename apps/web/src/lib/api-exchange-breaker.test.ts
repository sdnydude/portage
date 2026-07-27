import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, requestExchange, _resetExchangeBreakerForTests } from "./api";

// Breaker semantics for the session-exchange path (2026-07-27 incident: a
// sequential 401 storm produced 120+ /auth/session calls ending in 429).
describe("requestExchange breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetExchangeBreakerForTests();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not call /auth/session again during the cooldown after a transient (429) failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).rejects.toThrow();
    await expect(requestExchange()).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after the cooldown expires and a success clears the breaker", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: "fresh", user: { id: "u1" } }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).rejects.toThrow();
    vi.advanceTimersByTime(5_001);
    await expect(requestExchange()).resolves.toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("escalates the cooldown on consecutive failures (5s is not enough after the second)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).rejects.toThrow(); // failure 1 → 5s
    vi.advanceTimersByTime(5_001);
    await expect(requestExchange()).rejects.toThrow(); // failure 2 → 15s
    vi.advanceTimersByTime(5_001);
    await expect(requestExchange()).rejects.toThrow(); // still cooling — no fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a success resets the escalation — the next failure cools 5s again, not 15s", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) }) // fail 1
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "fresh", user: null }) })
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }); // fail after success
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).rejects.toThrow();
    vi.advanceTimersByTime(5_001);
    await expect(requestExchange()).resolves.toBe("fresh");
    vi.advanceTimersByTime(10_001); // clear the success-reuse window
    await expect(requestExchange()).rejects.toThrow(); // fail — if counter reset, cooldown = 5s
    vi.advanceTimersByTime(5_001);
    await expect(requestExchange()).rejects.toThrow(); // must reach fetch again (4th call)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reuses a token minted moments ago instead of re-fetching (remount storm throttle)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: "fresh", user: null }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).resolves.toBe("fresh");
    await expect(requestExchange()).resolves.toBe("fresh"); // within 10s window
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_001);
    await expect(requestExchange()).resolves.toBe("fresh"); // window over — real fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a definitive 401 exchange (session lost, storage wiped) sets no cooldown", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: "fresh", user: null }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestExchange()).rejects.toThrow();
    // No time advanced: a legitimate re-login attempt right after the wipe
    // must reach the network, not a stale cooldown.
    await expect(requestExchange()).resolves.toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one in-flight exchange", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: "fresh", user: null }) });
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([requestExchange(), requestExchange()]);
    expect(a).toBe("fresh");
    expect(b).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("api('/auth/session') never triggers its own 401→exchange retry (guard regression)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "CF required", code: "CF_REQUIRED" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/auth/session", { token: "t" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second /auth/session from a retry loop
  });
});
