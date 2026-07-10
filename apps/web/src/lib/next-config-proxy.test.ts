import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

// The /backend rewrite proxies every API call. The proxy timeout is pinned
// at 30s as a product decision (2026-07-10): users abandon after ~20-30s, so
// slow requests must be fixed at the latency source, not absorbed by a longer
// timeout. A request that hits this cap surfaces as an error — that is
// intentional feedback, not a bug to silence by raising the value.
describe("next.config /backend proxy", () => {
  it("pins proxyTimeout at exactly 30s (product decision — do not raise)", () => {
    expect(nextConfig.experimental?.proxyTimeout).toBe(30_000);
  });

  it("keeps the /backend rewrite in place", async () => {
    const rewrites = await nextConfig.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.beforeFiles ?? []);
    expect(list.some((r) => r.source === "/backend/:path*")).toBe(true);
  });
});
