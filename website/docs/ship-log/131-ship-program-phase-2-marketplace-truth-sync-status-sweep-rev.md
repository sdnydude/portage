---
title: "Ship-program Phase 2 — marketplace-truth sync (status sweep + Reverb order sync/backfill) + 10-finding review-fix batch + Reverb blank-model publish fix"
sidebar_label: "Ship-program Phase 2 — marketplace-truth sync (sta"
sidebar_position: 131
slug: ship-31c6404f
registry_id: 31c6404f-56ac-481e-a4dd-c967da3c8b9b
generated: true
---

# Ship-program Phase 2 — marketplace-truth sync (status sweep + Reverb order sync/backfill) + 10-finding review-fix batch + Reverb blank-model publish fix

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#299](https://github.com/sdnydude/portage/pull/299) |
| **Completed** | 2026-08-11 |
| **Model** | claude-fable-5 |

## Approach

additive periodic jobs in sync-worker; 45min sweep dripped through 5s tick; unknown=no-op; runOrderSync extracted to lib/order-sync.ts shared by route + periodic caller; TOCTOU closed via unique index + onConflictDoNothing; /code-review high findings all fixed pre-commit

## Commits

- b9ca9b8 fix(sync): marketplace-truth sync — status sweep, Reverb order sync/backfill + review-fix batch
- 5044535 Merge pull request #299

## Deferred Items

- Task 2.6 per-user sweep pacing — not built, PR-noted: single live seller, revisit trigger = second active seller (operator-approved via PR body approval + merge)

## Decisions

- pagination twin loops kept duplicated with cross-refs over shared-helper extraction (2 call sites, different response types)

## Review

- Agents: /code-review high multi-agent
- Critical found: 3 · Important found: 7

## Verification

- **lint:** clean (0 errors, 26 pre-existing warnings)
- **tests:** 909/909 api + 631/631 web
- **typecheck:** pass

**Tags:** `marketplace`, `sync`, `reverb`, `orders`, `review-fixes`
