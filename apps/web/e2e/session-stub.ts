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
  const ls = state.origins[0]?.localStorage ?? [];
  const token = ls.find((e) => e.name === "portage_token")?.value;
  const user = ls.find((e) => e.name === "portage_user")?.value;
  await page.route("**/backend/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token, user: user ? JSON.parse(user) : null }),
    }),
  );
}
