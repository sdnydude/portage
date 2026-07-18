import { test, expect, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

const SHOT = path.join(process.cwd(), "test-results", "proof", "r1-workbench");
const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";

const DESKTOP = { width: 1440, height: 900 };

// Proof screenshots publish to the docs site — let in-flight images settle
// first so a photo mid-load doesn't read as a rendering defect.
async function shot(page: import("@playwright/test").Page, name: string) {
  // networkidle alone never settles while background polling (e.g. the
  // Listing Optimizer spinner) is active — wait for images specifically.
  await page
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), undefined, {
      timeout: 4000,
    })
    .catch((e) => console.warn("[workbench.spec] best-effort image-settle wait:", String(e)));
  await page.screenshot({ path: path.join(SHOT, name), fullPage: true });
}

// R1 desktop workbench (Gate 2): master-detail on /inventory and /listings.
// The demo account guarantees neither >=2 items (arrow-key nav) nor >=1
// listing (focusListingId path), so the suite seeds its own fixtures through
// the real API and removes them afterwards — deterministic AND
// non-destructive. Item deletion cascades to listings (schema.ts onDelete).
const SENTINEL = "E2E Workbench";
const TITLES = [`${SENTINEL} Alpha`, `${SENTINEL} Bravo`, `${SENTINEL} Charlie`];

let api: APIRequestContext;
let token: string;
let authHeaders: Record<string, string>;
// createdAt DESC ordering → the list pane shows Charlie, Bravo, Alpha.
let alphaId: string;
let bravoId: string;
let charlieId: string;
let listingId: string;

async function deleteSentinelItems() {
  // Playwright's APIResponse doesn't throw on 4xx/5xx — without these
  // assertions an expired token silently leaks sentinel items into the
  // prod-mode DB (fix3 F4).
  const res = await api.get(`${API_BASE}/items?limit=100`, { headers: authHeaders });
  expect(res.ok(), `sentinel cleanup: GET /items failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  for (const item of body.items ?? []) {
    if (typeof item.title === "string" && item.title.startsWith(SENTINEL)) {
      const del = await api.delete(`${API_BASE}/items/${item.id}`, { headers: authHeaders });
      expect(del.ok(), `sentinel cleanup: DELETE /items/${item.id} failed: ${del.status()}`).toBeTruthy();
    }
  }
}

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const sess = await api.get(`${API_BASE}/auth/session`);
  expect(sess.ok(), `session exchange failed: ${sess.status()}`).toBeTruthy();
  token = (await sess.json()).token;
  authHeaders = { Authorization: `Bearer ${token}` };

  // Self-heal leftovers from a crashed prior run before seeding.
  await deleteSentinelItems();

  const ids: string[] = [];
  for (const title of TITLES) {
    const res = await api.post(`${API_BASE}/items`, {
      headers: authHeaders,
      data: { title, condition: "good", description: "R1 workbench e2e fixture." },
    });
    expect(res.ok(), `seed item failed: ${res.status()}`).toBeTruthy();
    ids.push((await res.json()).id);
  }
  [alphaId, bravoId, charlieId] = ids;

  const listingRes = await api.post(`${API_BASE}/listings`, {
    headers: authHeaders,
    data: { itemId: alphaId, marketplace: "ebay", price: 42 },
  });
  expect(listingRes.ok(), `seed listing failed: ${listingRes.status()}`).toBeTruthy();
  listingId = (await listingRes.json()).id;
});

test.afterAll(async () => {
  await deleteSentinelItems();
  await api.dispose();
});

test.describe("desktop workbench", () => {
  test.use({ viewport: DESKTOP });

  // The prod-mode API has no CF dev bypass, so AuthProvider's mount-time
  // exchangeSession() would 401 and wipe the seeded session — stub ONLY that
  // edge exchange; every data call stays real (see session-stub.ts).
  test.beforeEach(async ({ page }) => {
    await installSessionStub(page);
  });

  test("a. /inventory shows the workbench: list pane + empty detail hint", async ({ page }) => {
    await page.goto("/inventory");
    const workbench = page.getByTestId("workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByRole("region", { name: "Inventory list" })).toBeVisible();
    await expect(workbench.getByText(TITLES[2])).toBeVisible();
    // Behavioral pin against title collapse (the xl:grid-cols-4 pane
    // regression): the rendered title box must have real width, not just a
    // grid class string (fix3 F15a).
    const titleBox = await workbench.getByText(TITLES[2]).boundingBox();
    expect(titleBox, "card title has no layout box").toBeTruthy();
    expect(titleBox!.width).toBeGreaterThan(0);
    await expect(workbench.getByText("Select an item to view and edit it")).toBeVisible();
    await shot(page, "a-inventory-workbench.png");
  });

  test("b. clicking a card selects it into the detail pane without a full navigation", async ({ page }) => {
    await page.goto("/inventory");
    const workbench = page.getByTestId("workbench");
    const listPane = workbench.getByRole("region", { name: "Inventory list" });

    // Survives history.replaceState; a real navigation would wipe it.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__wbSentinel = "alive";
    });

    await listPane.getByRole("button", { name: TITLES[1] }).click();

    await expect(workbench.getByRole("heading", { name: TITLES[1] })).toBeVisible();
    await expect(page).toHaveURL(`/inventory?item=${bravoId}`);
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__wbSentinel),
    ).toBe("alive");
    await shot(page, "b-card-click-detail.png");
  });

  test("c. ArrowDown on the focused list pane moves selection and the detail follows", async ({ page }) => {
    await page.goto(`/inventory?item=${charlieId}`);
    const workbench = page.getByTestId("workbench");
    await expect(workbench.getByRole("heading", { name: TITLES[2] })).toBeVisible();

    // createdAt DESC → Charlie is row 1, Bravo row 2.
    await page.locator('div[aria-label="Inventory items — use arrow keys to browse"]').focus();
    await page.keyboard.press("ArrowDown");

    await expect(
      workbench.locator(`[data-item-id="${bravoId}"][aria-current="true"]`),
    ).toBeVisible();
    await expect(
      workbench.locator(`[data-item-id="${charlieId}"][aria-current="true"]`),
    ).toHaveCount(0);
    await expect(workbench.getByRole("heading", { name: TITLES[1] })).toBeVisible();
    await expect(page).toHaveURL(`/inventory?item=${bravoId}`);
    await shot(page, "c-arrowdown-selection.png");
  });

  test("d. title edit persists via PATCH, survives reload, then restores", async ({ page }) => {
    const EDITED = `${SENTINEL} Alpha (edited)`;
    const titleInput = page.locator('label:text-is("Title") + input');

    async function saveTitle(value: string) {
      await page.getByRole("button", { name: "Edit item" }).click();
      await expect(titleInput).toBeVisible();
      await titleInput.fill(value);
      const [patchRes] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "PATCH" && r.url().includes(`/items/${alphaId}`),
        ),
        page.getByRole("button", { name: "Save" }).click(),
      ]);
      expect(patchRes.ok(), `PATCH /items/${alphaId} failed: ${patchRes.status()}`).toBeTruthy();
      // Save routes back to the workbench (router.back()).
      await expect(page).toHaveURL(`/inventory?item=${alphaId}`);
    }

    await page.goto(`/inventory?item=${alphaId}`);
    const workbench = page.getByTestId("workbench");
    await expect(workbench.getByRole("heading", { name: TITLES[0] })).toBeVisible();

    await saveTitle(EDITED);
    await expect(workbench.getByRole("heading", { name: EDITED })).toBeVisible();
    await shot(page, "d1-title-edited.png");

    // Reload proves the PATCH persisted, not just local React state.
    await page.reload();
    await expect(page.getByTestId("workbench").getByRole("heading", { name: EDITED })).toBeVisible();
    await shot(page, "d2-title-persisted-after-reload.png");

    // Restore the original title (non-destructive contract) and re-assert.
    await saveTitle(TITLES[0]);
    await expect(page.getByTestId("workbench").getByRole("heading", { name: TITLES[0] })).toBeVisible();
    await shot(page, "d3-title-restored.png");
  });

  test("e. ?item= deep link cold-loads the item into the detail pane", async ({ page }) => {
    await page.goto(`/inventory?item=${bravoId}`);
    const workbench = page.getByTestId("workbench");
    await expect(workbench.getByRole("heading", { name: TITLES[1] })).toBeVisible();
    await expect(
      workbench.locator(`[data-item-id="${bravoId}"][aria-current="true"]`),
    ).toBeVisible();
    await shot(page, "e-deep-link.png");
  });

  test("f. /listings: clicking a listing focuses its card inside the item detail pane", async ({ page }) => {
    await page.goto("/listings");
    const workbench = page.getByTestId("workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByText("Select a listing to view and edit it")).toBeVisible();

    await workbench.locator(`button[data-item-id="${listingId}"]`).click();

    await expect(page).toHaveURL(`/listings?listing=${listingId}`);
    await expect(workbench.getByRole("heading", { name: TITLES[0] })).toBeVisible();
    // focusListingId path: the listing's own card is scrolled into view inside
    // the Marketplace Listings section of the detail pane.
    await expect(workbench.locator(`#listing-${listingId}`)).toBeInViewport();
    await shot(page, "f-listings-focus.png");
  });

  // Registry deferred item 334daef2 ("Workbench select-mode: card body click
  // navigates away (nested Link in toggle button)") — FIXED: select mode now
  // renders a non-interactive ItemCard (interactive={false}) inside the
  // toggle, so no <a> exists to navigate. This scenario pins that fix.
  test("g. select-mode card-BODY click toggles selection without navigating away", async ({ page }) => {
    await page.goto("/inventory");
    const workbench = page.getByTestId("workbench");
    const listPane = workbench.getByRole("region", { name: "Inventory list" });

    await listPane.getByRole("button", { name: "Select", exact: true }).click();
    await expect(listPane.getByRole("button", { name: "Done", exact: true })).toBeVisible();

    // The fix removes the nested link entirely — assert that first, then
    // click the card BODY (its title), not the checkbox overlay.
    await expect(listPane.locator(`a[href="/inventory/${bravoId}"]`)).toHaveCount(0);
    await listPane.getByText(TITLES[1]).click();

    // Let the client-side navigation (if any) actually land before asserting —
    // checking immediately passes spuriously because the toggle fires first
    // and the Link navigation completes a beat later.
    await page
      .waitForLoadState("networkidle", { timeout: 3000 })
      .catch((e) => console.warn("[workbench.spec] best-effort networkidle wait:", String(e)));
    await expect(page).toHaveURL(/\/inventory(\?.*)?$/);
    await expect(workbench).toBeVisible();
    // ...and the click actually toggled the card's selection, it wasn't inert.
    await expect(
      listPane.getByRole("button", { name: `Deselect ${TITLES[1]}` }),
    ).toHaveAttribute("aria-pressed", "true");
    await shot(page, "g-select-mode-body-click.png");
  });
});

// The lg band (1024-1439) runs the workbench with narrower panes than the
// 1440 desktop project — previously untested (fix3 F15c).
test.describe("lg band", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await installSessionStub(page);
  });

  test("a2. /inventory workbench layout smoke at 1280x800", async ({ page }) => {
    await page.goto("/inventory");
    const workbench = page.getByTestId("workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByRole("region", { name: "Inventory list" })).toBeVisible();
    await expect(workbench.getByText(TITLES[2])).toBeVisible();
    const titleBox = await workbench.getByText(TITLES[2]).boundingBox();
    expect(titleBox, "card title has no layout box").toBeTruthy();
    expect(titleBox!.width).toBeGreaterThan(0);
    await expect(workbench.getByText("Select an item to view and edit it")).toBeVisible();
    await shot(page, "a2-inventory-workbench-1280.png");
  });
});

test.describe("mobile intact", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await installSessionStub(page);
  });

  test("h. phone viewport hides the workbench; cards stay links to the detail route", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByTestId("workbench")).toBeHidden();
    const card = page.locator(`a[href="/inventory/${charlieId}"]`);
    await expect(card).toBeVisible();
    await shot(page, "h1-mobile-inventory.png");

    await card.click();
    await expect(page).toHaveURL(`/inventory/${charlieId}`);
    await expect(page.getByRole("heading", { name: TITLES[2] })).toBeVisible();
    await shot(page, "h2-mobile-item-detail.png");
  });
});
