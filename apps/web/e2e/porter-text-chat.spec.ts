import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOT_DIR = path.join(process.cwd(), "test-results", "proof");

// Phase 2 gate: with the voice feature removed, Porter TEXT chat must still
// stream end-to-end against the rebuilt :3002 container, and no voice UI
// (mic buttons, push-to-talk FAB) may render anywhere. This spec is LIVE —
// /porter/stream is not mocked, so the assertion proves the whole path:
// app container → api container → LLM → SSE → rendered assistant message.

test("Porter text chat streams end-to-end with no voice UI anywhere", async ({ page }) => {
  test.setTimeout(120_000);

  // Non-home tab: the FloatingMic push-to-talk FAB used to render here.
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: "Porter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Push to talk" })).toHaveCount(0);
  await page.screenshot({ path: path.join(SHOT_DIR, "voice-gone-inventory.png"), fullPage: false });

  // Home ask card: used to swap in a hold-to-talk mic when the input was empty.
  await page.goto("/home");
  await expect(page.getByPlaceholder("Ask Porter…")).toBeVisible();
  await expect(page.getByRole("button", { name: /hold to talk/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, "voice-gone-home.png"), fullPage: false });

  // Porter tab: input row used to carry a VoiceButton next to send.
  await page.goto("/porter");
  const input = page.getByPlaceholder("Ask Porter…");
  await expect(input).toBeVisible();
  await expect(page.getByRole("button", { name: "Voice input" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /talk/i })).toHaveCount(0);

  // Live text exchange — the reply must stream back and render. The user
  // bubble already contains the marker once, so a real assistant reply is
  // proven only by a SECOND occurrence appearing.
  await input.fill("Reply with exactly: VOICE_GONE_TEXT_OK");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect
    .poll(() => page.getByText("VOICE_GONE_TEXT_OK").count(), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(2);

  // No audio playback element may appear after a completed exchange.
  await expect(page.locator("audio")).toHaveCount(0);
  await page.screenshot({ path: path.join(SHOT_DIR, "voice-gone-porter-text-chat.png"), fullPage: false });
});
