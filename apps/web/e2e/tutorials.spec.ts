import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Tutorial hub + topic player against the rebuilt :3002 container.
// Screenshots are committed assets (public/tutorials/**), so the player
// renders real PNGs — no network mocking needed.

test.describe("tutorial hub", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hub lists all 8 topics and a topic plays through with overlays, surviving reload", async ({ page }) => {
    await page.goto("/tutorials");
    const slugs = ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"];
    for (const slug of slugs) {
      await expect(page.locator(`a[href="/tutorials/${slug}"]`)).toBeVisible();
    }
    await page.screenshot({ path: path.join(SHOT_DIR, "tutorials-hub.png"), fullPage: true });

    await page.locator('a[href="/tutorials/setup"]').click();
    await expect(page.getByRole("heading", { name: "Get Set Up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your marketplaces" })).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay").first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, "tutorials-topic-playing.png") });

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Set your seller defaults" })).toBeVisible();

    // Reload mid-topic: the route is real (not client-only state) — the topic
    // page re-renders from the URL at step 1.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Get Set Up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your marketplaces" })).toBeVisible();
  });
});
