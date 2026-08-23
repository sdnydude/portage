import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { installSessionStub } from "./session-stub";

/** P4 — /about is reachable from every surface the disclaimer can send a seller to. */
const SHOT = path.join(process.cwd(), "test-results", "proof", "p4");
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
}

test("/about renders the approved sections and is linked from the avatar menu, sidebar and More", async ({ page }) => {
  await installSessionStub(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about");
  for (const name of ["About Portage", "AI suggestions", "Beta terms", "Liability waiver", "Privacy and full terms", "Contact"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/legal/terms");
  // The floating tab bar must not cover the last section on a phone.
  const contact = page.getByRole("heading", { name: "Contact" });
  await contact.scrollIntoViewIfNeeded();
  const box = (await contact.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(812 - 80);
  await shot(page, "about-mobile-375.png");

  await page.goto("/more");
  await expect(page.getByRole("link", { name: /About/ })).toHaveAttribute("href", "/about");
  await page.getByRole("link", { name: /About/ }).scrollIntoViewIfNeeded();
  await shot(page, "more-about-link-mobile.png");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");
  await shot(page, "about-desktop-1280.png");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "About" })).toHaveAttribute("href", "/about");
  await shot(page, "avatar-menu-about-desktop.png");
  await expect(page.getByRole("navigation").getByRole("link", { name: /About/ })).toHaveAttribute("href", "/about");
});
