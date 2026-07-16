---
sidebar_position: 5
title: R1 Workbench Verification
---

# R1 Desktop Workbench — Gate 2 Verification

Deterministic Playwright proof for the Phase R1 desktop workbench (master-detail
`/inventory` and `/listings`, branch `feat/ui-refactor`). Follows the
[Frontend E2E Verification](./frontend-e2e-verification.md) conventions: real
app, real API, real database — non-destructive (capture → mutate → assert →
restore), reload-asserted persistence, screenshots as byproducts of the spec.

## Spec

`apps/web/e2e/workbench.spec.ts` — 8 scenarios, desktop viewport 1440×900
(plus a 390×844 mobile-regression check). The suite seeds its own fixtures
through the API (3 items + 1 draft eBay listing, sentinel-titled
`E2E Workbench *`) and deletes them afterwards, so it does not depend on
account state.

| # | Scenario | Proof |
|---|----------|-------|
| a | `/inventory` renders the workbench: list pane + "Select an item" empty hint | list pane, hint visible |
| b | Card click → detail pane shows the item; URL becomes `/inventory?item=<id>` via `history.replaceState`; a window sentinel proves **no navigation** | pane follows click |
| c | `ArrowDown` on the focused list pane moves `aria-current` to the next card; detail pane + URL follow | keyboard nav |
| d | Title edit → `PATCH /items/:id` observed → `page.reload()` re-asserts → original title **restored** and re-asserted | durable persistence |
| e | Cold `page.goto('/inventory?item=<id>')` deep link hydrates the pane | deep link |
| f | `/listings` card click → item detail pane with the listing's own card scrolled into view (`focusListingId` path) | listing focus |
| g | Select-mode card-**body** click must toggle selection without navigating away — **`test.fixme`, genuinely fails** (see below) | nested-Link guard |
| h | 390×844: workbench hidden, cards remain links to `/inventory/<id>` | mobile intact |

## Results (2026-07-15)

```bash
E2E_API_URL=http://127.0.0.1:8027 E2E_BASE_URL=http://127.0.0.1:3005 \
  npm run test:e2e -w apps/web -- workbench.spec.ts
# 8 passed, 1 skipped (fixme g)  ← fresh `next build` of feat/ui-refactor (standalone, :3005)

E2E_API_URL=http://127.0.0.1:8027 npm run test:e2e -w apps/web -- workbench.spec.ts
# scenario a additionally fails on the :3002 container only because the image
# predates the pane-grid fix below — green after the next
# `docker compose up -d --build portage-app`
```

Auth used the dev-mode API recipe (session exchange on a local
`CF_ACCESS_DEV_EMAIL` API, tokens honored by the prod API via shared
`JWT_SECRET`) plus `e2e/session-stub.ts` for AuthProvider's mount-time edge
exchange. All data calls are real.

## Regression found and fixed

Scenario **a** caught a live rendering defect the unit suite could not see: the
workbench list pane reused `ItemsGrid`'s viewport-scoped column classes, so at
`xl` the 380px pane laid cards out **4-across** and every card title collapsed
to zero width (invisible). Fixed by a `pane` prop pinning the pane grid to two
columns (`apps/web/src/app/(tabs)/inventory/page.tsx`), red-first unit test in
`workbench.test.tsx`. Web unit suite after fix: **483/483**.

## Known defect confirmed live (scenario g — `test.fixme`)

The registry-deferred *"select-mode card body click navigates away (nested
Link in toggle button)"* risk (deferred item `334daef2`, high priority)
**reproduces**: in workbench select mode a card-body click toggles the
selection and then the nested link-mode `ItemCard` completes a client-side
navigation to `/inventory/<id>`, swapping the whole workbench out. Notably, a
naive assertion right after the click passes — the toggle fires first and the
navigation lands a beat later — so the spec settles on `networkidle` before
asserting. The scenario is committed as `test.fixme` with the failing
assertions intact; un-fixme it when the deferred item is fixed.

| Evidence — post-click state (should still be the workbench) |
|--------------------------------------------------------------|
| ![navigated away](/img/verification/r1-workbench/g-select-mode-navigates-away-defect.png) |

## Proof screenshots

Workbench + empty hint, then card click selecting into the detail pane:

| a — workbench + empty hint | b — card click → detail pane |
|----------------------------|------------------------------|
| ![workbench](/img/verification/r1-workbench/a-inventory-workbench.png) | ![card click](/img/verification/r1-workbench/b-card-click-detail.png) |

Keyboard navigation and the deep link:

| c — ArrowDown moves selection | e — ?item= deep link |
|-------------------------------|----------------------|
| ![arrowdown](/img/verification/r1-workbench/c-arrowdown-selection.png) | ![deep link](/img/verification/r1-workbench/e-deep-link.png) |

Edit persistence (PATCH → reload → restore):

| d1 — edited | d2 — persisted after reload | d3 — restored |
|-------------|-----------------------------|---------------|
| ![edited](/img/verification/r1-workbench/d1-title-edited.png) | ![persisted](/img/verification/r1-workbench/d2-title-persisted-after-reload.png) | ![restored](/img/verification/r1-workbench/d3-title-restored.png) |

Listings focus:

| f — listing card focused in pane |
|----------------------------------|
| ![listings focus](/img/verification/r1-workbench/f-listings-focus.png) |

Mobile intact (390×844):

| h1 — inventory (no workbench) | h2 — card link → item detail route |
|-------------------------------|------------------------------------|
| ![mobile inventory](/img/verification/r1-workbench/h1-mobile-inventory.png) | ![mobile detail](/img/verification/r1-workbench/h2-mobile-item-detail.png) |
