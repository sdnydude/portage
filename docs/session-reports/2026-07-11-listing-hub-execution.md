# Listing-hub merge: full 6-task plan executed in one evening (PRs #207–#212)

**Span:** 2026-07-11 afternoon → evening · **Model:** claude-fable-5

## The story

The session opened on a finalized plan (`docs/superpowers/plans/2026-07-11-listing-hub-merge.md`, 4 review rounds) and closed with all six tasks merged: the listing detail page is gone, `inventory/[id]` is the single canonical detail page with a Marketplace Listings card hub, and a new buyer-eye preview page shares real PNGs.

Before execution, the Reverb edit-sync gap found during the plan's advisor review was folded in as Task 6 — during which the TODO's "adapter update path is thin" note turned out stale (only brand/model mapping was missing).

Execution ran task-by-task under tdd-guard, each task one PR, merged on green checks with CodeRabbit riding along:

- **#207 (T1):** `GET /listings?itemId=` filter. tdd-guard forced a stronger test than the plan's — a WHERE bound-param proof that walks drizzle `Param` nodes, since a schema-only change passed the naive 200 test.
- **#208 (T2):** Marketplace Listings section, deep-link scroll+highlight, cross-list CTA demotion with a new `CreateListingSheet.allowedMarketplaces` prop. Three CI/CodeRabbit rounds hardened it: e2e specs now **self-seed items via the API** (the ephemeral CI DB has no prod rows, and the CTA demotion broke every spec that clicked "List on Marketplace" on the first inventory item), the CTA gates on a successful listings fetch, and archived deep-links auto-expand the archive section.
- **#209 (T3):** Full action surface ported into `ListingCard` — price edit with the ported guard, publish with aspect/weight recovery sheets (brand/model prefill via props), archive/delete behind a new shared `ConfirmSheet`, relist, GTC date line (both old gtc-date tests ported), tap-to-copy marketplace ID with surfaced clipboard failure. Found and fixed a real bug: `formatCurrency` rounded $25.50 to $26.
- **#210 (T4):** The cutover. 851-line page → resolver-redirect; five consumer sites retargeted (PublishSuccess gained an `itemId` prop threaded at 4 flow call sites); four live e2e specs retargeted; `phase-f-archive` deliberately keeps the old URL as a redirect proof. Plan deviation: `useAuth` exposes no `isReady` — AuthProvider blocks rendering until the session settles, so the guard is plain `!isAuthenticated`.
- **#211 (T6):** Reverb edit-sync with a deliberate guard asymmetry — Reverb syncs on `marketplaceListingId` alone (remote Reverb drafts are revisable; the real listing from PR #177 is exactly that state), eBay stays active-only. Live proof: `PUT /listings/99270095` hit the real Reverb API; the 403 "account under review" is Reverb-side shop setup, not code.
- **#212 (T5):** Preview + PNG share. The plan's CORS spike **failed** — R2's public domain sends no CORS headers, and no available credential has R2 bucket-config scope (both Doppler CF tokens turned out to be the *same* token, id e56fd53a…, no R2/zone perms; the R2 S3 keys are object-only). An authed api image proxy was built, then superseded by Stephen's mid-session directive: proxy `portage-images` through the app's reverse proxy — a `/img-cdn/:path*` rewrite in `next.config.ts`, same mechanism as `/backend`. Same-origin images can't taint the canvas; the spike re-ran clean, and the e2e downloads a real 456KB PNG of the live ASUS card.

Local e2e against the prod-mode API needed one more invention: AuthProvider re-exchanges the CF Access session on every mount, which wipes seeded tokens on a LAN run with no CF edge. `e2e/session-stub.ts` stubs only that edge exchange from storage state — everything below it stays real.

## Learnings

- Ephemeral-CI e2e specs must self-seed their fixtures via the API; any spec that leans on "the first inventory item" or hardcoded prod rows breaks the moment UI gating (like CTA demotion) or a fresh DB changes the world.
- tdd-guard's one-test-at-a-time discipline caught two real weaknesses the plan's own test sketches missed: the itemId filter test that passed without the filter, and the empty-allowedMarketplaces test that passed for the wrong reason (price validation).
- The eBay "draft = nothing to sync" rule must not be generalized: Reverb publish returns remote drafts that carry a listing id and are fully revisable.
- Verify plan snippets against current code before porting: `isReady` was provider-internal, and the "thin Reverb update path" note was stale.

## Insights

- R2 public-domain images taint canvas capture; an app-origin rewrite (`/img-cdn`) sidesteps CORS with zero credentials and works on every stack including ephemeral CI, where a bucket CORS rule would do nothing.
- `formatCurrency` with `maximumFractionDigits: 0` silently rounds cents — a display-formatting bug that ships unless a non-integer case is tested explicitly.
- CF-Access-era e2e on LAN needs the session-exchange edge stubbed (`session-stub.ts`); the CI stack sidesteps it with the dev bypass, so the failure only appears locally.

## Deferred

- R2 bucket CORS for portage-images (swap for `/img-cdn` when an R2-Admin token exists; both Doppler CF tokens are one token without R2 scope)
- Item bbaddd00's live eBay revise fails "valid eBay leaf category required" — stored specifics likely lack categoryId; every item edit silently skips revising ItemID 307038681268
- Hoist duplicated status-pill config (listing-card vs listings tab)
- e2e seed/cleanup helper consolidation next to session-stub.ts
- ListingCard state folds (17 → ~8) now that the port source is deleted
