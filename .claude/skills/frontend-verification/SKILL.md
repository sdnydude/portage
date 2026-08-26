---
name: frontend-verification
description: Use when building, fixing, refactoring, or reviewing any apps/web (Next.js) change in Portage, or before claiming any frontend feature or bugfix is done, working, fixed, or ready. Symptoms it applies — you are about to say "done"/"works"/"fixed" on FE work having only run typecheck/lint, you touched a hook/page/component, or you wired components together.
---

# Frontend Verification

## Overview

**Compiles + lint ≠ works.** `tsc --noEmit` proves it type-checks. `eslint` proves it's tidy. Neither proves the app *runs* or that the pieces are *wired correctly*. The recurring failure mode in Portage has been declaring frontend work "done" on those two signals alone, shipping apps that pass in isolation and break when assembled. That gap is where features rot at 60–80%.

This skill enforces two gates for every `apps/web` change. The second is load-bearing.

**Violating the letter of these gates is violating the spirit. "Done" is blocked until both pass.**

## When to Use

- Building/fixing/refactoring anything under `apps/web/` (pages, components, hooks).
- Before saying "done", "works", "fixed", "ready", or creating a PR for FE work.
- Reviewing a frontend change for correctness.

**When NOT to use:** pure backend (`apps/api`) work, or docs/config-only edits with no runtime behavior. (tdd-guard covers BOTH workspaces — see the truth note under Gate 1.)

## The Two Gates

### Gate 1 — Test the LOGIC (not the pixels)

Write Vitest tests for branching logic only: hooks, state machines, reducers, the listing-flow wiring, diff/payload builders, anything with an `if`. Extract such logic into a plain `.ts` module so it is testable without rendering.

**Do NOT** test presentational components (markup, class names, static JSX). That noise is what got the tdd-guard validator resented — keep signal high.

**Truth note (reconciled 2026-08-25, P7 90ca92c2):** the `apps/web` exemption was REMOVED — `.claude/tdd-guard/data/config.json` has no path exemption and `apps/web/vitest.config.ts` runs the tdd-guard reporter, so red-first applies to web edits too (see `.claude/rules/tdd-one-test-per-write.md`). The guidance above still holds for WHAT to test: branching logic, not presentational markup — the guard enforces rhythm, not pixel tests.

### Gate 2 — Deterministic e2e against the rebuilt container (non-negotiable)

Before claiming done: **rebuild the `portage-app` container**, then run a committed **Playwright e2e test** (`npm run test:e2e -w apps/web`) that drives the actual changed flow against the real `:3002` and **asserts a reloaded outcome**. Green = proof. No passing e2e → not done.

The gate is an **automated, repeatable test** — NOT a human (or Claude) clicking through the app once and eyeballing a screenshot. Manual driving is non-deterministic, observer-dependent, and skippable; it is the same weak "verification" that lets wiring failures through. Screenshots are a *byproduct* the spec emits, not the gate itself.

Verify against the **rebuilt container**, not a dev server. Reasons: (1) `:3002` is the real artifact users hit; (2) the image build runs `next build`, stricter than `tsc --noEmit` — catches server/client-boundary and bundling errors dev never surfaces; (3) Docker does not hot-reload. `npm run dev:web` is for *mid-iteration only*, never as proof of done.

**Mocked unit tests do not satisfy this gate.** A wall of green `vi.mock` tests proves your code matches a stub you wrote — not that the integration works. Only the e2e exercises the assembled system.

## Harness Setup (one-time, per repo)

If `apps/web` has no `vitest` in devDependencies, stand it up first (mirror `apps/api`'s `vitest` version):

```bash
npm i -D -w apps/web vitest@^3.1.0 jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Do NOT add `@vitejs/plugin-react`.** In this monorepo it pulls `vite@8` while `vitest@3` resolves `vite@7`, producing an incompatible-types error in `vitest.config.ts` that fails `npm run typecheck` (tsconfig includes `**/*.ts`). Vitest transforms TSX via esbuild on its own; set `esbuild.jsx: "automatic"` so JSX needs no React import. The plugin only adds Fast Refresh, which tests don't use.

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
```

`apps/web/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
Add to root `package.json` scripts: `"test:web": "npm run test -w apps/web"`.

If `apps/web` has no `@playwright/test` (Gate 2 e2e), stand it up too:
```bash
npm i -D -w apps/web @playwright/test
cd apps/web && npx playwright install chromium
```
Create `apps/web/playwright.config.ts` (`testDir: "./e2e"`, `baseURL: process.env.E2E_BASE_URL ?? "http://10.0.0.251:3002"`, `headless: true`, `ignoreHTTPSErrors: true`), add `"test:e2e": "playwright test"` to `apps/web`, and `"test:e2e": "npm run test:e2e -w apps/web"` to root. Specs live in `apps/web/e2e/*.spec.ts`. Full reference + worked example: `website/docs/development/frontend-e2e-verification.md`.

## Gate 2 Recipe — deterministic e2e

Portage facts (verified): app on **:3002**, IP **10.0.0.251**. Demo login: **demo@portage.app / demo1234demo1234**. Login form: `input[type=email]` / `input[type=password]` / button "Sign In". Add `aria-label`s to icon buttons so specs (and screen readers) can target them.

1. Write/extend `apps/web/e2e/<flow>.spec.ts`: log in, drive the exact changed flow, assert visible outcome, **`page.reload()` and re-assert** (proves persistence, not local state). Keep non-destructive: capture original → mutate → assert → restore. Emit screenshots to `test-results/proof/`.
2. **Rebuild** so the container serves your latest code: `docker compose up -d --build portage-app`.
3. Run `npm run test:e2e -w apps/web`. Green = proof.
4. Copy proof screenshots into `website/static/img/verification/<flow>/` and reference from a Docusaurus page. Show the human.

## Completion Gate — ALL must pass before "done"

```
[ ] npm run typecheck   (all workspaces, clean)
[ ] npm run lint        (clean)
[ ] npm run test:web    (logic tests green)
[ ] docker compose up -d --build portage-app   (prod build passes)
[ ] npm run test:e2e -w apps/web   (deterministic e2e green vs :3002)
[ ] proof screenshots stored in Docusaurus
```

## Red Flags — STOP, you are about to ship broken work

- "Typecheck and lint pass, so it's done." → No. Run the app.
- "It's a small change, no need to run it." → Small changes break wiring. Run it.
- "I'll just describe what it should do." → Describing ≠ verifying. Drive the flow.
- "The component renders, so it works." → Rendering ≠ wired. Exercise the action + reload.
- "No test harness, so I'll skip Gate 1." → Stand the harness up (above), then test the logic.

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Compiles + lint = done" | Compiles ≠ works. Integration failures pass both. |
| "Frontend is hard to test" | Logic isn't. Extract it to a `.ts` module and test that. |
| "Running the app is slow" | Slower is debugging a 60%-done app the user abandoned. |
| "Unit tests cover it" | Unit tests miss wiring. Gate 2 catches wiring. Both required. |
| "User can just check it" | The proof is YOUR job. Show it, don't outsource it. |

## Common Mistakes

- Testing presentational JSX (low value, high noise) instead of hooks/state (high value).
- Driving the flow once but not reloading — misses persistence/refetch bugs.
- Verifying against `npm run dev:web` while the Docker `portage-app` (what others hit) runs stale code.
- Claiming the flow works from reading code instead of executing it.

## Why this exists

Encodes Stephen's 2026-06-05 directive after a year of integration failures: targeted logic tests + a mandatory run-the-app proof gate. (The original decision paired this with a blanket tdd-guard exemption for `apps/web`; that exemption was later removed — the guard now covers web too, and the two gates still define what "proof" means.) See memory `feedback_frontend_verification_gate`.
