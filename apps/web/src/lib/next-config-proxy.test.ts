import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

// The /backend rewrite proxies every API call. Next's proxy default is 30s
// (proxyTimeout || 30_000), which aborted real scans that legitimately run
// 30-40s (two-pass refine + vision-provider fallback) — the browser saw the
// non-JSON 500 as "Unknown error". Pin a proxy timeout comfortably above the
// slowest observed scan so the rewrite can never silently reintroduce the cap.
describe("next.config /backend proxy", () => {
  it("sets an explicit proxyTimeout of at least 120s", () => {
    expect(nextConfig.experimental?.proxyTimeout).toBeGreaterThanOrEqual(120_000);
  });

  it("keeps the /backend rewrite in place", async () => {
    const rewrites = await nextConfig.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.beforeFiles ?? []);
    expect(list.some((r) => r.source === "/backend/:path*")).toBe(true);
  });
});
