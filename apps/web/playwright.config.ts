import { defineConfig, devices } from "@playwright/test";

/**
 * Deterministic e2e harness. Runs against the REAL running app (the rebuilt
 * portage-app container on :3002 by default), not a dev server — verifying the
 * artifact users actually hit. Override the target with E2E_BASE_URL.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://10.0.0.251:3002";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
