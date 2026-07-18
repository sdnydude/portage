---
sidebar_position: 4
title: Frontend E2E Verification
---

# Frontend E2E Verification

Deterministic end-to-end verification for `apps/web`. The gate for any frontend
change is **not** "typecheck + lint pass" and **not** a human clicking through the
app once — it is an automated [Playwright](https://playwright.dev) test that drives
the real flow against the **rebuilt `portage-app` container** (`:3002`, what users
actually hit) and returns the same pass/fail every run.

> Compiles ≠ works. Mocked unit tests ≠ works. Only a deterministic e2e that
> exercises the assembled app proves the wiring.

## Harness

| Piece | Location |
|-------|----------|
| Runner | `@playwright/test` (apps/web devDependency) |
| Config | `apps/web/playwright.config.ts` (baseURL `E2E_BASE_URL`, default `http://10.0.0.251:3002`) |
| Auth | `apps/web/e2e/auth.setup.ts` — one CF Access session exchange per run (dev bypass or `E2E_CF_CLIENT_ID/SECRET` service token), shared with all specs via `storageState` |
| Specs | `apps/web/e2e/*.spec.ts` |
| Script | `npm run test:e2e -w apps/web` (also chained into root `test:all`) |
| CI | `.github/workflows/e2e.yml` — builds an isolated ephemeral stack from `docker-compose.e2e.yml`, pushes schema, seeds demo data, runs the suite, tears down |

```bash
# 1. Rebuild the container so it serves the latest code (no hot-reload)
docker compose up -d --build portage-app
# 2. Run the deterministic e2e against the real artifact
npm run test:e2e -w apps/web
```

## Worked example — item-detail inline edit

`e2e/inline-edit.spec.ts` authenticates via the shared session (auth.setup.ts),
opens the first inventory item, edits the **Brand** field in the inline edit panel, saves, **reloads the
page**, and asserts the change persisted — then restores the original value so the
test is repeatable and non-destructive. The reload is the point: it proves the
`PATCH /items/:id` actually persisted, not just local React state.

Result: `1 passed (1.8s)` against `portage-app` on `:3002`.

### Proof

Read-only → edit mode → saved → persisted after reload:

| Read-only | Edit mode |
|-----------|-----------|
| ![read-only](/img/verification/inline-edit/1-readonly.png) | ![editing](/img/verification/inline-edit/2-editing.png) |

| Saved | Persisted after reload |
|-------|------------------------|
| ![saved](/img/verification/inline-edit/3-saved.png) | ![persisted](/img/verification/inline-edit/4-persisted-after-reload.png) |

The post-reload screenshot shows `Brand: E2E-INLINE-EDIT` rendered from a fresh
API fetch — durable proof the write reached the database.

## Worked example — photo tools (exposure + inline BG removal)

`e2e/photo-tools.spec.ts` covers the 2026-07-07 photo-tools changes:

- **Exposure tool** — opens the item-detail photo editor, drags the EV slider to
  +1, applies (server bakes `brightness(2^ev)` via Sharp), and re-asserts the
  `*_exposure.jpg` URL after a reload.
- **Inline BG removal** — taps *BG Remove* and asserts the removal starts
  immediately (no interstitial CTA page), accepts the before/after preview, then
  **samples a corner pixel of the saved file and asserts it is white** — the
  regression this guards was rembg's transparent PNG rendering black. Reload
  re-asserts the persisted `*_nobg.jpg`.

Both restore the item's original photos array afterward (non-destructive).

### Proof

| EV slider (+1) | Applied | Persisted after reload |
|----------------|---------|------------------------|
| ![slider](/img/verification/photo-tools/exposure-1-slider.png) | ![applied](/img/verification/photo-tools/exposure-2-applied.png) | ![persisted](/img/verification/photo-tools/exposure-3-persisted-after-reload.png) |

| Inline processing (no CTA page) | Before/after preview | White bg persisted after reload |
|--------------------------------|----------------------|--------------------------------|
| ![processing](/img/verification/photo-tools/bg-1-inline-processing.png) | ![preview](/img/verification/photo-tools/bg-2-before-after-preview.png) | ![white](/img/verification/photo-tools/bg-3-white-persisted-after-reload.png) |

## Adding a new flow

1. Add a label/role-accessible handle to any control the test must target
   (e.g. `aria-label="Edit item"` on icon buttons) — improves a11y too.
2. Write `apps/web/e2e/<flow>.spec.ts` driving the real user path; assert visible
   outcomes and **reload** to prove persistence.
3. Keep specs non-destructive: capture original state, mutate, assert, restore.
4. Rebuild the container, run `npm run test:e2e -w apps/web`, confirm green.
