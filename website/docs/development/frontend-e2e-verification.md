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
| Specs | `apps/web/e2e/*.spec.ts` |
| Script | `npm run test:e2e -w apps/web` (also chained into root `test:all`) |

```bash
# 1. Rebuild the container so it serves the latest code (no hot-reload)
docker compose up -d --build portage-app
# 2. Run the deterministic e2e against the real artifact
npm run test:e2e -w apps/web
```

## Worked example — item-detail inline edit

`e2e/inline-edit.spec.ts` logs in as the demo user, opens the first inventory
item, edits the **Brand** field in the inline edit panel, saves, **reloads the
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

## Adding a new flow

1. Add a label/role-accessible handle to any control the test must target
   (e.g. `aria-label="Edit item"` on icon buttons) — improves a11y too.
2. Write `apps/web/e2e/<flow>.spec.ts` driving the real user path; assert visible
   outcomes and **reload** to prove persistence.
3. Keep specs non-destructive: capture original state, mutate, assert, restore.
4. Rebuild the container, run `npm run test:e2e -w apps/web`, confirm green.
