# 2026-08-03 (evening) — Best Offer crisis, redesign, and live repair

## The story

The session resumed to ship a 20-finding adversarial audit batch on the marketplace
sync refactor. Mid-session, the operator hit the real incident behind it all: **price
edits were blocked on every Best-Offer-enabled eBay listing**, and the shipped "fix"
(#285 + its hardening) was resolving threshold conflicts by **deleting the seller's
live Best Offer configuration** — one listing (`307100024169`) lost its thresholds on
eBay this way. The operator ruled: functionality is never deleted to make an operation
pass, and ordered a ground-up rebuild through /debug, /advisor review, and an
architect/engineer/advisor agent-trio plan.

Three PRs shipped and deployed:

- **#287** — the audit batch: sync badge truth (dual-source + unresolved-failure
  scope), transactional enqueue, worker tenant invariant/re-entrancy/retention,
  retry rate limit, poll versioning, and more (19 of 20 findings; the 20th became M2).
- **#288** — the Best Offer redesign: typed Trading errors with stable ErrorCodes
  (22003/23004), 422 conflicts carrying the actual numbers at create AND update,
  the downgrade-delete retry removed from updates, explicit toggle-off as the ONLY
  deletion path, pre-flight validation at every price/threshold surface, conflict-time
  GetItem heal (eBay owns live truth), server-side JSONB merge with null-delete
  sentinel, and the app's first post-publish Best Offer UI (card price editor).
  Fix-first audit round (3 must-fix) + CodeRabbit round (5 fixed, 1 duplicate) landed
  before merge.
- **#289** — operator-escalated criticals: atomic single-statement JSONB merge
  (concurrent saves can no longer erase each other), per-marketplace offers state in
  the publish sheet (eBay thresholds ≠ Reverb boolean — the shared checkbox that
  corrupted both is gone), GetCategoryFeatures deterministic category pre-flight
  (prose matcher demoted to a narrowed backstop), Reverb card offers toggle,
  additive local pickup, 5-line description editors.

**Live proof (operator's browser, screenshots + eBay read-backs):** SanDisk
`307100024169` restored to $240/$220; Samsung `307100136291` — the originally blocked
edit — completed at $199 with $191/$175; M2 explicit-disable cycle proved DeletedField
placement on real eBay; the GetItem BestOfferDetails parse verified against live XML;
Reverb toggle persisted `offersEnabledExplicit` through the atomic merge. The
reconciliation sweep then verified all 13 offer-enabled listings against live eBay:
11 already exact, 2 healed (a $0.25 garbage minimum → $255; a dormant $220 accept on
a $145 listing → $138/$125). Portage and eBay now agree everywhere.

## Learnings

- Never resolve a marketplace conflict by deleting seller configuration; surface the
  numbers and let the seller fix price + settings in one edit.
- eBay validates price changes against thresholds STORED on the live listing even
  when the request omits them; Revise omission ≠ deletion (DeletedField required,
  now live-proven).
- Stable ErrorCodes (22003 auto-decline, 23004 auto-accept) beat prose matching;
  GetCategoryFeatures(BestOfferEnabled) makes category support a deterministic
  pre-flight instead of error archaeology.
- Read-modify-write JSONB merges lose updates under concurrency; a single-statement
  `current || set − nulls` SQL merge closes the class, but clients must send
  key-scoped payloads or they defeat it.
- Two marketplaces' "same" feature (offers) with different semantics must never share
  UI state.
- An unverified XML parse must never drive deletions: the heal refuses to delete
  unless the live block positively parsed (guard written before the parse was
  live-verified; verification came later the same night).
- tdd-guard validates against the last vitest run through `npm run test -w apps/api`
  only — direct `npx vitest` runs are invisible to it.

## Insights

- The marketplace card price editor is the natural home for per-marketplace offer
  controls — post-publish parity gap between eBay and Reverb closed by mirroring the
  same surface.
- CF Access service tokens in Doppler are not authorized on the Portage Access app;
  live-app automation runs through the operator's browser session instead.
- The ephemeral e2e stack (credless) exercises exactly the found:false heal branch —
  useful, but live GetItem verification still required the real account.

## Deferred / carried forward (operator-approved timing)

- Flow floor-note gap: deep-link listing-flow entry never runs prepare in-page, so an
  AI-prepared floor wouldn't display on that path (scan path works; server 422 blocks
  any conflict from publishing). Fix = run prepare on item-entry. Operator chose
  next-session timing after live proof.
- Publish-time category-unsupported warn-downgrade retained at create (operator
  decision); tighten with logged ErrorCodes as data accumulates.

## Damage repaired tonight

- `307100024169` (SanDisk 2TB): thresholds restored $240/$220, eBay-confirmed.
- `307100136291` (Samsung 970): blocked $199 edit completed with $191/$175,
  eBay-confirmed.
- `307100158774` (SanDisk 1205): $0.25 garbage minimum → $255, eBay-confirmed.
- `307100003462` (Samsung 860): dormant $220 accept on $145 price → $138/$125,
  eBay-confirmed.

Suites at close: 857 API / 615 web, typecheck clean, lint 0 errors. `main` at #289
merge; both containers rebuilt and healthy.
