import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // tdd-guard reporter: writes results to the repo-root guard data so red-first
    // is enforced on apps/web (the **/apps/web/** exemption was removed).
    reporters: ["default", ["tdd-guard-vitest", { projectRoot: "../../" }]],
  },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
