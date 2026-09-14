---
title: "Outage rollback, batch 2026-09-06 landing, rescan-from-inventory (2026-09-10 → 2026-09-13)"
registry_id: fd15ea04-6a57-4eda-8b7e-fc5c8b0d15b6
---

# Outage rollback, batch landing, rescan — 2026-09-10 → 2026-09-13

## Story

The session opened 09-10 with a small ask: a Rescan button on inventory. Brainstormed three shapes; the operator chose C, a per-field diff sheet (current vs new scan, seller picks fields, one PATCH, never an overwrite). Built TDD in a worktree off main: `lib/rescan-diff.ts`, `RescanDiffSheet`, item-detail wiring. For proof I deployed the worktree build to prod on 09-11.

That deploy is the incident. `docker compose up -d --build portage-app` also recreated `portage-api`, because a 09-08 session had built (never deployed) an API image from the unmerged batch branch whose schema selected three `seller_profiles` columns that were never pushed. Every eBay/Reverb publish 500'd for 38 hours; the operator found it on 09-13 with a Reverb publish ("Internal server error"). Root cause in the log within minutes (`column "ebay_returns_accepted" does not exist`), rolled back by rebuilding the API from main and recreating only that container. First Reverb publish after rollback succeeded (listing 101790226, $349).

The rescan PoD then hit a second wall: eBay-imported items carry `i.ebayimg.com` photos and `/scan/refine` only allowed the R2 origin. Fixed with a fixed-host allowlist plus seller-facing wording on the client; PoD passed on the Anker PowerExpand item (row + provenance in DB). The operator's first reaction to the sheet: the description still opened "I am selling". That ban lived only on the unmerged batch branch. Which surfaced the real problem: the whole 09-06 batch, seven lanes, had been sitting in an open PR for five days with db:push, merge, deploy, and device check all undone. Operator: "none of the work is live. wtf?"

Four read-only advisors reviewed PR #374 (eBay adapter, deploy/DB safety, code, CI). Findings became eight fixes, built TDD on the batch branch: per-listing handling time now beats the profile default in the Trading builder (the reverse order had killed the publish-sheet control); the Listings-page price edit now carries the return policy like the item-edit path; `HeaderActions` hides at `lg` (TopBar already renders both controls on desktop); pager clamps when total shrinks; Porter's trigram fallback degrades instead of failing the turn; lane-E multi-value aspects pinned through to POST /items; CI seeds 201 items and un-skips the pagination/header walks, session stub widened so page loads stop burning auth exchanges, workbench reuses the setup token. Proof came from the isolated e2e stack (13/13), CI went green, PR #374 merged. The three columns were pushed live first (exactly three ADD COLUMN, verified with `--verbose`).

The recall gap got a mechanical fix mid-session: `recall-before-write.sh`, a PreToolUse hook that, for every source Edit/Write/Agent dispatch, lists the other files already using the identifiers being introduced, adds CodeGraph callers and one registry search, and injects the result. Replaying the lane-F edit surfaces `handlingDays` in five files and the per-listing shipping ship session; the lane-C prompt surfaces `top-bar.tsx`. It was live for the rest of the session.

Rescan was then lifted onto a fresh branch off merged main (3-way clean) and took three review passes of its own. Category row removed (item.category is the eBay leaf name; candidate.category the vision bucket). The adapter reviewer caught a critical in my own fix: filtering closed-list aspect values without reading `aspectMode` would drop legitimate FREE_TEXT values like Brand and 422 every revise. `getRequiredAspects` now records the mode; only SELECTION_ONLY lists are filtered; NFC-normalized match; cache entry evicted when the gate throws; `vision.filterAspectsToAllowed` follows the same rule. Sheet close is ignored and Cancel disabled while Apply is in flight; Tab focus trap added. A new `e2e/rescan-proof.spec.ts` (stubbed refine, real PATCH, API read-back, own sentinel item) provided the push-gate proof and now runs in CI. PR #375 merged; one deploy from main c7ac21c; Chrome walk on prod confirmed header cluster, pager, rescan on an ebayimg item with a clean description opener, Porter word search. Zero API errors since.

Cleanup closed it: nine stale worktrees removed after per-file checks, eight review records and one handoff note preserved.

## Learnings

- `docker compose up -d --build <one service>` recreates other services whose image changed since their container started. A built-but-undeployed image on `latest` is a loaded gun. Diff every container's image ID before and after; tag rollback images first; push schema before any image that expects it.
- Failure count divided by attempt count is the impact metric. "Only 2 errors in 40 hours" was 2 of 2 attempts, a total outage.
- Parallel build lanes with narrow prompts collide with existing code because nothing consults the memory systems at write time. Capture was never the gap; recall at the moment of writing was.
- eBay Taxonomy ships `aspectValues` for FREE_TEXT aspects as suggestions. Any closed-list filter must key on `aspectMode === SELECTION_ONLY`.
- The ephemeral e2e stack's auth limiter is 120 exchanges per 15 minutes per identity, and the session stub's glob has to match the direct API host or every page load spends one.
- An open PR with pending deploy steps is the first item in every intake, not a footnote.

## Insights

- Recall-before-write as a hook, not a rule: the hook runs the searches itself and injects results, the same pattern as the KB-inject hooks. Rules asking the model to search first drift.
- The proof-before-push gate forced a real e2e proof spec for rescan that CI now runs. The friction produced durable coverage.
- The commit gate's review-record requirement drove three review passes on rescan; two of them found real bugs in the fixes for the first one.

## Deferred

None. Every review finding was fixed in-session. Watch item (not a deferral): the lane-G description omitted the "Overview" label once on prod while keeping the other section labels; operator confirmed the descriptions as the baseline.

## Refs

PRs #374 (bd1bb41), #375 (c7ac21c). Commits 973c876, d8e9206, 8e2050d. Reverb listing 101790226. Rollback tags `portage-{api,app}-rollback:2026-09-13`.
