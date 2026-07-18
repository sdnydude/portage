# Portage — Incomplete-Work Backlog (live execution queue)

> **SUPERSEDED by `docs/TODO.md` Phases 5–7.** Kept as a historical record; do not execute from this file.

Lettered phases continuing the AI-specifics plan (A–D shipped this session).
Each phase is a vertical slice: **not done until wired end-to-end and proven
running in the app.** Source of truth for "what's left to reach beta/v1."

Mirrored to the DHG Registry (`deferred_items`) so the session briefing surfaces them.

**eBay ATO lock — RESOLVED** (eBay cleared case 1241573 on 2026-06-20). Live
publish/order actions are no longer blocked; **all phases are live-verifiable.**
(Confirm at the first real publish that egress is clean.)

---

## Shipped this session (for context)
- **A** `43ff199` — scan AI-fills eBay specifics into the scan response. ✅ live
- **B/C** `129b76c` — `items.aspects` column + carry into all publish paths (kills the
  aspect pop-up for captured specifics) + fix MPN→25002 bug. ✅ live, 513 api tests
- **D** `e2c9c51` — scan UI persists aspects on save. ✅ wired, full e2e green (no regression)

---

## Phase E — AI Identification Panel  ⬜ next
**Problem:** Phase A fills `candidate.aspects` from the scan, but the scan UI deliberately
ignores them (Stage-1 "no AI prefill" decision). They have no consumer yet, so the AI's
richer specifics never reach the saved item — the pop-up only stays closed for Brand/Model.
**Do:** Build `AiIdentificationPanel` — surface AI-suggested aspects with `[AI]` tags,
three-state confirm (suggested → confirmed → missing), seed `aspectValues` from
`candidate.aspects` on confirm. This is what makes A actually land and fully closes the pop-up.
**Done when:** scan → AI panel shows filled specifics → confirm → save → publish carries them,
no pop-up (proven by a fake-camera Playwright e2e — see deferred camera-e2e item).

## Phase F — Unify publish + price & terms panels  ⬜ (design agreed)
**Problem:** Two divergent publish paths — item-detail `CreateListingSheet` (has price +
marketplace + terms + aspect panels) vs scan **Save & List** (publishes directly, **no panels**).
That split is why panels appear "gone" on one path.
**Do:**
- Route both paths through **one** publish-confirm sheet.
- **Price panel** (confirm/edit price every publish).
- **Terms panel** (`DisclaimerSheet`) with an opt-in **"don't show for 7 days"** checkbox:
  - unchecked by default (never auto-suppress legal terms),
  - **version-scoped** — voided when `CURRENT_DISCLAIMER_VERSION` bumps (re-show updated terms),
  - **server-side** via `disclaimer_acceptances` + a `suppress_until` timestamp (holds across devices),
  - first acceptance still **recorded**; the TTL only suppresses the re-*prompt*.
- Two-state publish **result** (success / draft-saved with the verbatim eBay reason) — original Phase F.
**Done when:** both publish paths show price + terms, the 7-day dismiss works and resets on version bump,
and the result screen shows success vs draft-saved.

### ⚑ Fold in here — A–E adversarial-review findings (2026-06-22)
Deferred from the A–E review (Devstral + Qwen3-Coder + qwen3.6-27b evaluator + in-code
verification). F5 (PATCH aspects read-merge) and F11 (`mergeAspectSuggestions` array guard)
were **fixed in the A–E ship**; these three remain and belong with the publish-path unification:
- **F6 (MEDIUM)** — `ebay-adapter.ts` `updateListing` (~635) is less defensive than `createListing`:
  it sets `product.aspects = specific.aspects` raw, skipping the value-normalization loop (382–392),
  the Brand/Model/MPN aspect backfill (393–395), and the required-aspect gate (403–419). A scalar/null
  aspect or a missing required specific can slip to eBay on an active-listing edit. **Fix:** extract the
  create-path aspect-normalization into a shared helper and call it on the update path too (the required
  gate stays publish-only). Reconcile while the two publish paths are being unified here.
- **F2 (LOW)** — `vision.ts` `ListingFieldsOutputSchema.ebay.aspects` comment claims a malformed bag
  "degrades to {}"; `.default({})` only covers *undefined*, so a present-but-malformed (null/object)
  value throws a controlled 502 in the **unguarded** prepare-listing path. **Fix:** either wrap
  prepare-listing's `generateListingFields` in the same non-fatal guard `prefillCandidateAspects` uses,
  or correct the comment.
- **F9 (LOW, optional UX)** — `aspect-seeding.ts` `mergeAspectSuggestions` surfaces AI aspect values
  without checking them against eBay's enumerated `aspect.values`; a user can confirm a value eBay later
  rejects at publish. **Fix:** filter AI suggestions against `aspect.values` when the aspect is enumerated.

## Phase G — "Save & List" actually lists (not a silent draft)  ⬜ NEW
**Problem (verified):** scan **Save & List** saves a **draft**, not a live listing.
`scan-listing-payload.ts:30` — `publishMode = profile?.ebayPublishMode ?? "draft"`
(safe default: an unexpected live listing is unrecoverable). Defeats the user's expectation
that "List" lists.
**Do:** Let the user choose **live** at publish (in the F sheet, gated by terms), keep the
safe default for silent paths. Ensure a chosen-live Save & List produces a live listing.
**Done when:** Save & List with "publish live" results in an active eBay listing (not a draft),
verified live in the app (ATO cleared — verifiable now).

## Phase H — Orders sync (broken for weeks)  ⬜ NEW
**Problem (reported):** orders have not synced in weeks. Mechanism exists
(`orders.ts:164` `adapter.getOrders(since)`) but no recent sync — cause **unconfirmed**
(candidates: eBay token/ATO, no scheduled job, or a `getOrders` failure swallowed).
**Do:** Diagnose root cause (don't assume); fix; ensure a **recurring** sync (scheduled) +
working manual sync + surfaced errors instead of silent failure. (ATO cleared — verifiable now.)
**Done when:** recent eBay orders appear after a sync, on a schedule, with errors visible.

## Phase I — Remove in-app carriers; use the eBay shipping policy  ⬜ NEW (was: build carriers)
**Direction (user, 2026-06-22):** carrier integration is **deferred**. Do NOT build
EasyPost/Shippo. **Remove** the in-app carrier shipping (stubbed rates, label purchase,
carrier-provider connect/config) and rely on the **eBay fulfillment (shipping) policy set
during eBay setup** — which the publish path already applies (`applySellerPolicyDefaults`
fills `fulfillmentPolicyId` from the seller profile).
**Do:** Remove/hide the carrier-rate + label-purchase UI and the stubbed shipping endpoints
(`shipping.ts` mock rates, `shipping_providers`, the rate-select/label step in the ship-order
flow). Keep what the eBay policy needs (weight/dims already on the item; the fulfillment
policy id). Make the order/ship UI reflect "shipping handled by your eBay policy," not in-app labels.
**Caution:** scope the removal carefully — don't rip out item weight/dims (used by eBay
Calculated shipping) or the fulfillment-policy plumbing. Inventory the 16 shipping endpoints
and the ship page before deleting.
**Done when:** no in-app carrier rates/labels surface; publishing uses the eBay shipping policy;
nothing that eBay publish depends on (weight/dims, fulfillment policy) is broken.

---

## Deferred (not phases)
- **Camera-driven scan→save Playwright e2e** — the suite avoids `getUserMedia`; author at Phase E
  (fake camera + intercept `/scan/refine`), asserts item.aspects + no publish pop-up.
