import { test, expect } from "@playwright/test";

// :3002 over plain http on the LAN IP is not a secure context, so the SW never
// registers there (and chromium's insecure-origin flag proved inert in this
// build). The suite runs on g700data1 itself, so http://localhost:3002 is the
// SAME rebuilt container through a secure-context origin — SW registers.
const LOCAL_ORIGIN = "http://localhost:3002";

// iOS WebKit drops multipart bodies when the service worker replays a POST
// via respondWith(fetch(request)) — uploads arrived with content-length: 0
// (empty-body 500 clusters in Loki, 07-10 → 08-31). The fix: sw.js bails on
// every non-GET so mutations never pass through the SW. This spec pins the
// deployed artifact on :3002 — the container users actually hit.

test("deployed sw.js never intercepts non-GET requests", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  const body = await res.text();

  // The non-GET bail must appear before any respondWith call. ("respondWith"
  // alone also matches the fix's own comment — anchor on the call syntax.)
  const bailIdx = body.indexOf("request.method !== 'GET'");
  const respondIdx = body.indexOf("event.respondWith(");
  expect(bailIdx).toBeGreaterThan(-1);
  expect(respondIdx).toBeGreaterThan(-1);
  expect(bailIdx).toBeLessThan(respondIdx);

  // Cache bump forces installed SWs (byte-diff) to update off the buggy version.
  expect(body).toContain("portage-v4");
});

test.describe("sw-controlled page", () => {
  test("multipart POST passes through a controlling SW and reaches the API", async ({ page }) => {
    await page.goto(`${LOCAL_ORIGIN}/home`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlled).toBe(true);

    // Unauthenticated multipart POST: the API's auth middleware answering with
    // its JSON 401 proves the request crossed the SW to the server intact —
    // an SW-mangled or dropped request could never produce the API's own
    // error envelope. (Auth runs before body parsing, so no token is needed.)
    const result = await page.evaluate(async () => {
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(64)], { type: "image/png" }), "probe.png");
      const res = await fetch("/backend/images", { method: "POST", body: form });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty("code");
  });
});
