# Beta-blocker triage: scan outage, fabricated constraints, and Porter grounding

**Session span:** 2026-08-05 early morning → evening (ET)
**Branches:** `fix/vision-schema-coercion` → PR #292; `fix/reverb-pickup-additive-publish` → PR #293. Both merged to `main` (`05c2a28`).

## The arc

The session opened on a total scan outage — every image submitted to `/scan/refine`
returned a generic "unknown error" — and ended with the operator's AI assistant
caught fabricating inventory items. In between, three separate live blockers were
root-caused and fixed, several live data repairs were applied to the operator's
real eBay and Reverb listings, and one of the app's own encoded "rules" turned out
to have been invented by Claude rather than sourced from a marketplace.

### 1. The scan outage — provider drift with no guard

`POST /scan/refine` was returning 502 `AI_RESPONSE_INVALID` on every attempt.
The Gemini call itself succeeded (200, `fallbacks:0`); the failure was Zod parse
of a *successful* response. `gemini-3.5-flash` had drifted to returning
`candidates[].weight` as a bare number instead of `{value, unit}`. The provider
chain only fell over on *call* failure, never on parse failure, so the Claude
fallback never engaged and drift became a total outage.

Config fix first (chain pinned to `gemini-2.5-flash` + `claude-haiku-4-5`),
then the class fix: coercions with a 0–1600 oz plausibility guard (implausible
values dropped rather than stamped into eBay calculated shipping), `weight: null`
handled, `reverb.year` number→string, and a new `AIOptions.validate` hook so
schema-invalid 200s fail over exactly like failed calls. Wired at all four vision
call sites through a shared `schemaValidator` that preserves per-schema Zod
diagnostics so the next drift incident stays triageable.

Two adversarial review rounds ran against this work. The first found an orphaned
red test, an asymmetry (the single-image `/scan` path had no failover while
`/scan/refine` did), and a diagnostic-loss regression. The second — after fixes —
found the `ebay.weight` coercion lacked the plausibility guard its own sibling
had, and that `generateListingFields` never got the validate hook at all. All
findings were closed before merge.

### 2. The fabricated Reverb Bump cap

The operator's 5% and 7.5% Bump bids were rejected as "out of range." The
0.5–3.5% cap enforced in three layers of the codebase had **no source**: it was
invented in PR #265 on 07-27, then propagated into an API pre-flight and web
validation by the 08-04 "fix" without anyone checking Reverb. Reverb's published
docs allow 0.5–30%, and Reverb's own suggested bids start around 4.5% — the app
was rejecting the marketplace's own recommendations. Corrected in all three
layers with the source cited in comments.

### 3. ConditionDescription on brand-new items

Price edits on a new-condition listing failed with "The ConditionDescription
field is not valid for new items." eBay forbids that field on ConditionID 1000;
it had been riding along from `conditionNotes` since the field was wired,
hard-blocking every edit of a brand-new listing. The builder now omits it for
1000 while new-other (1500) keeps it.

### 4. Best Offer thresholds the operator never wanted

A price drop was blocked by stored auto-accept ($144) and minimum ($135)
thresholds. The operator had only entered those values because an earlier flow
refused to save without them. The thresholds were cleared live via the API and
eBay revised in the same call. The underlying UX defect — price surfaces hide
the thresholds that can block the save — was filed.

### 5. Stale listing statuses

A "Saved locally but failed to sync" error traced to a listing that had ended on
eBay with no order while the app row still read active (Trading error 291). A
read-only sweep of all 19 active Reverb listings against Reverb's API found 8
more mismatches: 6 sold, 2 ended. Root cause: the reconciliation in
`listings.ts:370` only re-checks rows in `draft` status — `active` rows are never
re-checked, ever. Statuses were corrected; the automation gap was filed.

### 6. Reverb publishing local-pickup-only

The operator reported that Reverb listings published as pickup-only even with
shipping configured. Two stacked causes: the seller profile's Reverb default was
`{local: true}` with no shipping profile id, so every enrichment produced
pickup-only specifics; and even when a profile id *was* present, the adapter's
profile-wins branch silently dropped `localPickup` — shipping and pickup were
mutually exclusive in both directions. A live probe against listing 100019158
proved Reverb accepts `shipping_profile_id` and `shipping.local` together
(profile rates stay attached, pickup shows). The seller default was fixed, all
11 active Reverb listings repaired with per-listing read-back verification, and
the adapter now sends both on create and update. eBay was checked for the same
class and is not affected — pickup rides there as an additive second shipping
service.

### 7. Porter had no knowledge of the inventory

Porter's `search_inventory` tool existed, worked, and was correctly passed to the
model — but Porter's chat chain ran `local,gemini,anthropic`, meaning **qwen3:4b**
answered. Live testing returned empty responses on two of three queries. The
middle fallback appeared hard-broken (`400 no body`), leaving only Claude working.

Moved to `qwen3:14b` at the operator's direction (Porter must run local; gemini
as backup, no Claude) — 9.6 GB, fits the 16 GB RTX 5080 fully on GPU. Tool-calling
then worked and real inventory came back. But the operator spotted a fabricated
item: "Black Lion Audio Microphone Preamp" does not exist in his inventory.
Three controlled runs confirmed qwen3:14b invents items on most attempts even
with an explicit anti-invention rule in the system prompt; gemma4:12b fails
differently, never calling the search tool. This is unresolved at session end.

A proposal to render search results deterministically server-side was rejected by
the operator as self-limiting and unscalable — it would require bespoke rendering
per tool and would break compositional questions. The replacement proposal,
not yet approved, is grounding validation: verify that every item the model names
exists in the tool's returned rows, and on mismatch fail over like a failed
provider call, reusing the `AIOptions.validate` mechanism shipped in PR #292.

## Learnings

- A provider that returns HTTP 200 with structurally wrong output is a failure
  mode that call-level error handling cannot see; failover must be driven by
  output validity, not just transport success.
- Encoding a marketplace constraint without a primary-source citation created a
  bug that survived two "fix" commits and rejected the marketplace's own
  recommended values.
- A deferred item describing an unguarded live path is a prediction, not a note:
  the 07-19 Gemini fallback item and the 08-02 pickup-drop item both described
  the exact failures that became this session's emergencies.
- Small local models corrupt data they are asked to repeat. Prompt rules do not
  fix it — three runs with an explicit anti-invention instruction still produced
  invented inventory.
- `.env` values wrapped in quotes are stripped by the container but survive in
  host-side scripts, producing "invalid API key" errors that look like provider
  outages and can mislead diagnosis for weeks.

## Insights

- The vision provider chain's blind spot (fail over on call failure but not on
  parse failure) is the same shape as Porter's hallucination problem: output that
  arrives successfully but is wrong. One validation-and-failover mechanism
  addresses both.
- Reverb accepts `shipping_profile_id` and `shipping.local` simultaneously —
  profile rates remain attached and pickup shows. Live-verified, not documented.
- eBay rejects `ConditionDescription` on ConditionID 1000 but accepts it on 1500.
- `glm-4.7-flash` (19 GB) exceeds the RTX 5080's 16 GB and only benches
  acceptably by spilling to CPU; `qwen3:14b` at 9.6 GB is the practical ceiling
  for fully-resident local inference on this box.
- Reverb's `/categories/flat` majority-match rule means items whose category
  string shares few words with any Reverb category (e.g. "Cables, Snakes &
  Interconnects") resolve to nothing and hard-block publish.

## Deferred

- Porter grounding validation — approach proposed, not approved, not built.
- Marketplace status reconciliation for `active` rows (both marketplaces).
- Backfill orders for the 6 Reverb-sold listings + periodic Reverb order sync.
- Reverb category picker on the listing-card publish path.
- Price editors must surface the Best Offer thresholds that can block the save.
- Verify the `.env` quoting defect and re-test the 07-19 Gemini vision item,
  which is likely a phantom.
