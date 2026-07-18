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

  it("redirects the deleted password-auth routes to /home", async () => {
    // /login and /register were removed in the CF Access migration, but stale
    // entry points (bookmarks, the CF app launcher, password managers) still
    // request them — CF authenticates and returns the user to the original
    // URL, which 404s (live 2026-07-10). Permanent redirects neutralize every
    // stale entry point at once.
    const redirects = await nextConfig.redirects!();
    for (const source of ["/login", "/register"]) {
      const r = redirects.find((x) => x.source === source);
      expect(r?.destination).toBe("/home");
      expect(r?.permanent).toBe(true);
    }
  });

  it("keeps the /backend rewrite in place", async () => {
    const rewrites = await nextConfig.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.beforeFiles ?? []);
    expect(list.some((r) => r.source === "/backend/:path*")).toBe(true);
  });
});
