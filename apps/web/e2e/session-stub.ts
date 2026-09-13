import type { Page } from "@playwright/test";

/**
 * CF Access is the identity edge. On a LAN run against the prod-mode API there
 * is no edge, so AuthProvider's mount-time exchangeSession() (GET
 * /auth/session) fails and wipes the storage-state token. Stub ONLY that edge
 * exchange, answering with the session already seeded in storage state —
 * every data call below it stays real. Import from any spec that drives an
 * authed page against a prod-mode API (Task 4 retargets more specs here).
 */
export async function installSessionStub(page: Page): Promise<void> {
  const state = await page.context().storageState();
  // Locate the origin actually carrying the session — origins[0] is not
  // guaranteed to be the app origin when multiple origins hold state.
  const ls =
    state.origins.find((o) => o.localStorage.some((e) => e.name === "portage_token"))
      ?.localStorage ?? [];
  const token = ls.find((e) => e.name === "portage_token")?.value;
  const user = ls.find((e) => e.name === "portage_user")?.value;
  // `**/auth/session` covers both the same-origin /backend rewrite and the
  // direct NEXT_PUBLIC_API_URL host the CI build uses. The old
  // `**/backend/auth/session` glob never matched in CI, so every page load
  // spent a real auth exchange and the 120/15-min limiter tripped the suite
  // (advisor 2026-09-13).
  await page.route("**/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token, user: user ? JSON.parse(user) : null }),
    }),
  );
}
