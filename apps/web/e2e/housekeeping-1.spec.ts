import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { installSessionStub } from "./session-stub";

/**
 * Housekeeping-1 proof (2026-08-23). LIVE against the rebuilt stack — the
 * price leg revises a real eBay listing (lowest-risk: $10, no Best Offer, no
 * orders) and restores it in-run. Gated like p3-bo-live.spec: never in CI.
 *   HK1_LIVE_ITEM_ID  — item that owns the live eBay listing
 */
test.skip(!process.env.E2E_EBAY_LIVE, "live eBay — set E2E_EBAY_LIVE=1 to run against the real stack");

const API_BASE = process.env.E2E_API_URL ?? "https://10.0.0.251:8016";
const SHOT = path.join(process.cwd(), "test-results", "proof", "housekeeping-1");
const ITEM_ID = process.env.HK1_LIVE_ITEM_ID ?? "";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

/** The inventory page renders mobile + workbench trees together; pick the visible card. */
function visibleCard(page: Page, itemId: string) {
  // Mobile card = <a href="/inventory/:id">; workbench card = <button data-item-id>.
  return page.locator(`a[href="/inventory/${itemId}"], [data-item-id="${itemId}"]`).filter({ visible: true }).first();
}

// A failed run must not leave fixture rows in the real inventory.
test.afterEach(async ({ page, request }) => {
  const api = await authed(page, request);
  const res = await request.get(`${API_BASE}/items?search=${encodeURIComponent("E2E HK1")}&limit=100`, { headers: api.headers });
  if (!res.ok()) return;
  for (const it of ((await res.json()).items ?? []) as { id: string; title: string }[]) {
    if (it.title.startsWith("E2E HK1")) await request.delete(`${API_BASE}/items/${it.id}`, { headers: api.headers });
  }
});

async function authed(page: Page, request: APIRequestContext) {
  const token = (await page.context().storageState()).origins
    .flatMap((o) => o.localStorage)
    .find((e) => e.name === "portage_token")?.value;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    getItem: async () => (await request.get(`${API_BASE}/items/${ITEM_ID}`, { headers })).json(),
    getListings: async () => (await request.get(`${API_BASE}/listings?itemId=${ITEM_ID}`, { headers })).json(),
    headers,
  };
}

test("[1] price truth: card edit → items.price; edit page → listings.price; both reach eBay; restored", async ({ page, request }) => {
  test.setTimeout(240_000);
  expect(ITEM_ID, "HK1_LIVE_ITEM_ID").toBeTruthy();
  await installSessionStub(page);
  const api = await authed(page, request);

  const before = await api.getItem();
  const original = Number(before.price);
  const bumped = original + 1;
  const bumped2 = original + 2;

  // Card → item
  await page.goto(`/inventory/${ITEM_ID}`);
  await expect(page.getByRole("heading", { name: before.title })).toBeVisible();
  await shot(page, "1a-detail-before.png");
  await page.getByRole("button", { name: /edit price/i }).click();
  await page.getByLabel("Price", { exact: true }).fill(String(bumped));
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0, { timeout: 90_000 });
  await page.reload();
  await expect(page.getByText(`$${bumped}`).first()).toBeVisible();
  await shot(page, "1b-card-edit-header-reflects.png");
  const afterCard = await api.getItem();
  expect(Number(afterCard.price)).toBe(bumped);
  console.log(`[live] card ${original}→${bumped}: items.price=${afterCard.price}`);

  // Edit page → listing
  await page.goto(`/inventory/${ITEM_ID}/edit`);
  await page.getByLabel("Price (USD)").fill(String(bumped2));
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/inventory/${ITEM_ID}$`), { timeout: 90_000 });
  await expect(page.getByText(`$${bumped2}`).first()).toBeVisible();
  await shot(page, "1c-edit-page-card-reflects.png");
  const listingsAfter = await api.getListings();
  const live = (listingsAfter.listings ?? listingsAfter).find((l: { status: string; marketplace: string }) => l.status === "active" && l.marketplace === "ebay");
  expect(Number(live.price)).toBe(bumped2);
  console.log(`[live] edit ${bumped}→${bumped2}: listings.price=${live.price} ebayId=${live.marketplaceListingId}`);

  // Restore
  await page.goto(`/inventory/${ITEM_ID}/edit`);
  await page.getByLabel("Price (USD)").fill(String(original));
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/inventory/${ITEM_ID}$`), { timeout: 90_000 });
  const restored = await api.getItem();
  expect(Number(restored.price)).toBe(original);
  await shot(page, "1d-restored.png");
});

/** Upload the fixture through the gallery picker and land on scan Review (refine stubbed, everything else real). */
async function scanToReview(page: Page) {
  await page.route(/\/images$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ image: { url: "https://picsum.photos/seed/hk1/640/640", key: "e2e/hk1.jpg", width: 640, height: 640 } }),
    });
  });
  await page.route(/\/scan\/refine$/, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ detailed: { candidates: [{
      name: "E2E HK1 Fender Stratocaster", description: "Housekeeping-1 proof item.", category: "electronics", condition: "good",
      conditionNotes: "", estimatedValueLow: 400, estimatedValueHigh: 600, brand: "Fender", model: "Stratocaster", features: [], confidence: 0.9,
    }], reasoning: "e2e fixture" } }) }),
  );
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Scan item" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "scan-item.jpg"));
  await page.getByRole("button", { name: /Scan 1 Photo/ }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 20_000 });
}

test("[2] aspect removal: live card (optimizer ✕) deletes the key on item + listing rows; scan review ✕ clears before save", async ({ page, request }) => {
  test.setTimeout(240_000);
  await installSessionStub(page);
  const api = await authed(page, request);

  // Live item: remove the optional "Features" specific via the optimizer panel.
  const before = await api.getItem();
  expect(before.aspects).toHaveProperty("Features");
  await page.goto(`/inventory/${ITEM_ID}`);
  const removeBtn = page.getByRole("button", { name: "Remove Features" });
  await removeBtn.scrollIntoViewIfNeeded();
  await shot(page, "2a-optimizer-before-remove.png");
  await removeBtn.click();
  await expect(page.getByRole("button", { name: "Remove Features" })).toHaveCount(0, { timeout: 60_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: before.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Features" })).toHaveCount(0);
  await shot(page, "2b-optimizer-after-remove-reload.png");
  const after = await api.getItem();
  expect(after.aspects).not.toHaveProperty("Features");
  const listingsAfter = await api.getListings();
  const live = (listingsAfter.listings ?? listingsAfter).find((l: { status: string }) => l.status === "active");
  expect(((live.marketplaceSpecificFields ?? {}).aspects ?? {})).not.toHaveProperty("Features");
  console.log(`[live] Features removed: item keys=${Object.keys(after.aspects).join(",")}`);

  // Scan review: the explicit ✕ clears a typed free-text specific; Save persists without it.
  await scanToReview(page);
  const header = page.getByRole("button", { name: /eBay item specifics/i });
  if (await header.count()) await header.first().click();
  const optional = page.getByRole("button", { name: /Show \d+ optional/i });
  if (await optional.count()) await optional.first().click();
  const textAspect = page.locator('input[placeholder^="Enter "]').filter({ visible: true }).first();
  await expect(textAspect).toBeVisible({ timeout: 30_000 });
  await textAspect.scrollIntoViewIfNeeded();
  const aspectName = (await textAspect.getAttribute("placeholder"))!.replace(/^Enter /, "");
  await textAspect.fill("ZZZ-HK1");
  await shot(page, "2c-scan-aspect-filled.png");
  await page.getByRole("button", { name: `Clear ${aspectName}` }).click();
  await expect(textAspect).toHaveValue("");
  await shot(page, "2d-scan-aspect-cleared.png");
  await page.getByLabel("Price (USD)").fill("5");
  const [itemsPost] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/items") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const created = await itemsPost.json();
  expect(created.aspects ?? {}).not.toHaveProperty(aspectName);
  console.log(`[live] scan item ${created.id} saved without ${aspectName}; aspects=${JSON.stringify(created.aspects)}`);
  await request.delete(`${API_BASE}/items/${created.id}`, { headers: api.headers });
});

test("[3/4] no estimated-value range anywhere: inventory card shows the set price, item detail has no Estimated Value panel, scan review has no Value Low/High", async ({ page, request }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);
  const api = await authed(page, request);
  const item = await api.getItem();

  await page.goto("/inventory");
  await page.getByPlaceholder("Search items...").first().fill(item.title.slice(0, 20));
  const card = visibleCard(page, ITEM_ID);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(`$${item.price}`);
  await expect(card).not.toContainText("–"); // the old "$min–$max" dash
  await shot(page, "3a-inventory-card-price-not-range.png");

  await page.goto(`/inventory/${ITEM_ID}`);
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  await expect(page.getByText("Estimated Value")).toHaveCount(0);
  await expect(page.getByText(/\$\d+ – \$\d+/)).toHaveCount(0);
  await shot(page, "3b-detail-no-estimated-value.png");

  await scanToReview(page);
  await expect(page.getByText("Value Low ($)")).toHaveCount(0);
  await expect(page.getByText("Value High ($)")).toHaveCount(0);
  await shot(page, "3c-scan-review-no-value-range.png");
});

/** WCAG relative-luminance contrast between two computed CSS colors. */
function contrastRatio(fg: string, bg: string): number {
  const parse = (c: string) => c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const [a, b] = [lum(parse(fg)), lum(parse(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("[5][6][7] chips: /listings marketplace + status chips readable (≥4.5:1 light AND dark), inventory card status + marketplace chips", async ({ page }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/listings");
    const row = page.getByRole("link").filter({ hasText: /eBay|Reverb/ }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const chips = row.locator("span").filter({ hasText: /^(eBay|Reverb|Active|Draft|Sold|Archived)$/ });
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
    const ratios: string[] = [];
    for (let i = 0; i < await chips.count(); i++) {
      const chip = chips.nth(i);
      const { text, fg, bg } = await chip.evaluate((el) => {
        const cs = getComputedStyle(el);
        let bg = cs.backgroundColor; let n: Element | null = el;
        while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { n = n.parentElement; if (n) bg = getComputedStyle(n).backgroundColor; }
        return { text: el.textContent, fg: cs.color, bg };
      });
      const r = contrastRatio(fg, bg);
      ratios.push(`${text}=${r.toFixed(2)}`);
      expect(r, `${scheme} ${text} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    console.log(`[chips ${scheme}] ${ratios.join(" ")}`);
    await shot(page, `5-listings-chips-${scheme}.png`);
  }

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/inventory");
  const card = visibleCard(page, ITEM_ID);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await expect(card.getByText("eBay", { exact: true })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await shot(page, "7-inventory-card-status-marketplace-chips.png");
});

test("[8] item status: set an unlisted item to Asset, persists after reload, Asset filter returns it; a live-listed item shows Active read-only", async ({ page, request }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);
  const api = await authed(page, request);
  const created = await (await request.post(`${API_BASE}/items`, {
    headers: api.headers,
    data: { title: "E2E HK1 Asset Item", description: "", category: "other", condition: "good", quantity: 1, photos: [] },
  })).json();

  await page.goto(`/inventory/${created.id}`);
  const select = page.getByLabel("Status");
  await expect(select).toBeEnabled();
  await select.selectOption("asset");
  await expect(select).toBeEnabled({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("asset");
  await shot(page, "8a-detail-status-asset-after-reload.png");
  const row = await (await request.get(`${API_BASE}/items/${created.id}`, { headers: api.headers })).json();
  expect(row.status).toBe("asset");
  expect(row.displayStatus).toBe("asset");

  await page.goto("/inventory");
  await page.getByRole("group", { name: "Filter by status" }).filter({ visible: true }).first().getByRole("button", { name: "Asset" }).click();
  await expect(visibleCard(page, created.id)).toBeVisible({ timeout: 30_000 });
  await shot(page, "8b-inventory-asset-filter.png");

  await page.goto(`/inventory/${ITEM_ID}`);
  const locked = page.getByLabel("Status");
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveValue("active");
  await shot(page, "8c-live-item-status-locked-active.png");
  await request.delete(`${API_BASE}/items/${created.id}`, { headers: api.headers });
});

test("[9] category chips come from the inventory itself and filter case-insensitively", async ({ page, request }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);
  const api = await authed(page, request);
  const { categories } = await (await request.get(`${API_BASE}/items/categories`, { headers: api.headers })).json();
  expect(categories.length).toBeGreaterThan(3);
  const top = categories[0] as { value: string; label: string; count: number };
  console.log(`[live] ${categories.length} chips; top = ${top.label} (${top.count})`);

  await page.goto("/inventory");
  const row = page.getByRole("group", { name: "Filter by category" }).filter({ visible: true }).first();
  await expect(row.getByRole("button", { name: new RegExp(`^${top.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${top.count}$`) })).toBeVisible();
  // The old static buckets are gone.
  await expect(row.getByRole("button", { name: "Clothing" })).toHaveCount(0);
  await row.getByRole("button", { name: new RegExp(`^${top.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
  await expect(page.getByText(`${top.count} item${top.count === 1 ? "" : "s"}`).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "9a-data-driven-category-chips-filtered.png");

  // Case-insensitive: a legacy capitalized spelling is the SAME chip (forced via SQL — writes normalize now).
  const created = await (await request.post(`${API_BASE}/items`, {
    headers: api.headers,
    data: { title: "E2E HK1 Capitalized Category", description: "", category: top.value, condition: "good", quantity: 1, photos: [] },
  })).json();
  execFileSync("docker", ["exec", "portage-db", "psql", "-U", "portage", "-d", "portage", "-c",
    `update items set category=upper(category) where id='${created.id}'`]);
  const after = await (await request.get(`${API_BASE}/items/categories`, { headers: api.headers })).json();
  const merged = (after.categories as typeof categories).find((c: { value: string }) => c.value === top.value);
  expect(merged.count).toBe(top.count + 1);
  const filtered = await (await request.get(`${API_BASE}/items?category=${encodeURIComponent(top.value)}`, { headers: api.headers })).json();
  expect((filtered.items as { id: string }[]).some((i) => i.id === created.id)).toBe(true);
  await request.delete(`${API_BASE}/items/${created.id}`, { headers: api.headers });
});

test("[10] condition notes: 5-row textareas on scan review + edit page; a 2000-char paste persists in full", async ({ page, request }) => {
  test.setTimeout(180_000);
  await installSessionStub(page);
  const api = await authed(page, request);

  await scanToReview(page);
  const scanNotes = page.getByPlaceholder(/minor scuff/i);
  await scanNotes.scrollIntoViewIfNeeded();
  expect(await scanNotes.evaluate((el) => (el as HTMLTextAreaElement).rows)).toBe(5);
  await shot(page, "10a-scan-review-notes-5-rows.png");

  const created = await (await request.post(`${API_BASE}/items`, {
    headers: api.headers,
    data: { title: "E2E HK1 Notes Item", description: "", category: "other", condition: "good", quantity: 1, photos: [] },
  })).json();
  await page.goto(`/inventory/${created.id}/edit`);
  const notes = page.getByPlaceholder(/scratches, wear, defects/i);
  expect(await notes.evaluate((el) => (el as HTMLTextAreaElement).rows)).toBe(5);
  const long = "N".repeat(2000);
  await notes.fill(long);
  await shot(page, "10b-edit-notes-5-rows-2000-chars.png");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/items/${created.id}`) && r.request().method() === "PATCH" && r.ok()),
    page.getByRole("button", { name: /^save$/i }).click(),
  ]);
  const len = execFileSync("docker", ["exec", "portage-db", "psql", "-U", "portage", "-d", "portage", "-At", "-c",
    `select length(condition_notes) from items where id='${created.id}'`]).toString().trim();
  expect(len).toBe("2000");
  console.log(`[live] condition_notes length=${len}`);
  await request.delete(`${API_BASE}/items/${created.id}`, { headers: api.headers });
});

test("[W] wiring audit on the real inventory: every status chip and marketplace chip matches the database", async ({ page, request }) => {
  test.setTimeout(300_000);
  await installSessionStub(page);
  const api = await authed(page, request);
  const psql = (q: string) => execFileSync("docker", ["exec", "portage-db", "psql", "-U", "portage", "-d", "portage", "-At", "-c", q]).toString().trim();
  const me = "c19b95dc-0d37-4d4b-9c00-fe86861c7034";
  const displayCase = `case
    when exists (select 1 from listings l where l.item_id=i.id and l.status='active') then 'active'
    when exists (select 1 from listings l where l.item_id=i.id and l.status='draft') then 'draft'
    when exists (select 1 from listings l where l.item_id=i.id and l.status='sold') then 'sold'
    else i.status::text end`;

  // 1. Status filter: API total per chip == DB count per derived status.
  const report: string[] = [];
  for (const status of ["active", "draft", "sold", "unlisted", "asset", "archived"]) {
    const apiTotal = (await (await request.get(`${API_BASE}/items?status=${status}&limit=1`, { headers: api.headers })).json()).total;
    const dbCount = Number(psql(`select count(*) from items i where i.user_id='${me}' and (${displayCase})='${status}'`));
    report.push(`${status}: api=${apiTotal} db=${dbCount}`);
    expect(apiTotal, `status=${status}`).toBe(dbCount);
  }
  console.log(`[wiring] status ${report.join(" | ")}`);

  // 2. liveMarketplaces per item == DB active listings per item (whole inventory).
  const all = (await (await request.get(`${API_BASE}/items?limit=100`, { headers: api.headers })).json()).items as Array<{ id: string; liveMarketplaces: string[]; displayStatus: string; price: number | null }>;
  const rows = psql(`select i.id||'|'||coalesce((select string_agg(distinct l.marketplace::text, ',' order by l.marketplace::text) from listings l where l.item_id=i.id and l.status='active'),'') from items i where i.user_id='${me}'`).split("\n");
  const dbLive = new Map(rows.map((r) => { const [id, m] = r.split("|"); return [id, m ? m.split(",").sort() : []]; }));
  let checked = 0;
  for (const it of all) {
    expect([...(it.liveMarketplaces ?? [])].sort(), `liveMarketplaces ${it.id}`).toEqual(dbLive.get(it.id) ?? []);
    checked++;
  }
  console.log(`[wiring] liveMarketplaces matched DB on ${checked} items`);

  // 3. Screens: each status chip on the real inventory, plus a Reverb card and the listings page with Reverb/Sold rows.
  await page.goto("/inventory");
  for (const [label, value] of [["Active", "active"], ["Draft", "draft"], ["Sold", "sold"], ["Unlisted", "unlisted"]] as const) {
    const group = page.getByRole("group", { name: "Filter by status" }).filter({ visible: true }).first();
    await group.getByRole("button", { name: label }).click();
    const total = (await (await request.get(`${API_BASE}/items?status=${value}&limit=1`, { headers: api.headers })).json()).total;
    await expect(page.getByText(`${total} item${total === 1 ? "" : "s"}`).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, `W-inventory-status-${value}.png`);
  }
  const reverbItem = all.find((i) => (i.liveMarketplaces ?? []).includes("reverb"));
  if (reverbItem) {
    await page.getByRole("group", { name: "Filter by status" }).filter({ visible: true }).first().getByRole("button", { name: "Active" }).click();
    const card = visibleCard(page, reverbItem.id);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText("Reverb", { exact: true })).toBeVisible();
    await shot(page, "W-inventory-card-reverb-chip.png");
  }
  const noPrice = all.find((i) => i.price == null);
  console.log(`[wiring] reverb-card=${reverbItem ? "yes" : "none"} no-price-card=${noPrice ? "yes" : "none"}`);

  await page.goto("/listings");
  const rowsLoc = page.getByRole("link").filter({ hasText: /eBay|Reverb/ });
  await expect(rowsLoc.first()).toBeVisible({ timeout: 30_000 });
  const reverbRow = rowsLoc.filter({ hasText: "Reverb" }).first();
  if (await reverbRow.count()) { await reverbRow.scrollIntoViewIfNeeded(); await shot(page, "W-listings-reverb-row.png"); }
});
