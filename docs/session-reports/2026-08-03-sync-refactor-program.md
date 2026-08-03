# Session Report — Marketplace Sync Refactor Program (PR #283)

**Span:** 2026-08-02 afternoon → 2026-08-03 morning
**Category:** feature
**PRs:** #276, #277, #278, #281 (merged), #283 (program, merged)

## The story

The session opened as housekeeping: four open PRs needed merging (#276 local-pickup, #277 payment-hold docs, #278 shipping docs, #281 session report). Branch protection's strict up-to-date requirement forced a serial update-branch → CI → merge chain — every merge invalidates the remaining PRs, and `gh pr merge --auto` doesn't auto-update branches. #276 got a real conflict check first (main merged in cleanly against #280's cascade changes, 5 shared files, zero conflicts). All four landed; #278's merge fired the docs deploy, verified live.

Mid-merge, Stephen attached the long-missing Reverb sync doc (Reverb's official sync-plugin integration guide + CSV field spec) — the blocker recorded in `reverb-sync-refactor-next`. Two Explore agents traced the entire edit-sync architecture; the findings were stark: both PATCH paths synced inline-awaited with zero durability, items.ts discarded Reverb adapter warnings and skipped enrichment, every listing PATCH re-sent photos (paying Reverb's stale-photo GET+DELETE sweep on price-only edits), and the canonical /edit page discarded the PATCH response so sync failures were invisible by design. A 4-phase plan was drafted (`whats-next_v4.md`, artifact 0d30ed96) and approved.

Overnight, three schema.ts edits came back "Denied by user" — a hard stop. Morning diagnosis (/debug): `guard-schema-push.sh` deliberately raises an ask-prompt on every schema.ts edit; the denials were dismissed prompts while Stephen was away, not vetoes. Lesson captured as an insight: consecutive denials scoped to one file with a known ask-guard = unattended prompt.

With auto mode confirmed, the program built through in one run:

- **P0 (e6c2e16):** contract unification — Reverb warnings surfaced, `applyReverbEnrichment` shared between both routes (best-effort with stored-specifics fallback), listings.ts soft-warn contract (marketplace AppError no longer fails the request after the local write landed), photo diff on both routes.
- **P1 (c618da7):** `marketplace_sync_log` table + `logSyncAttempt` fire-and-forget helper + writes on every edit-sync and publish attempt + paginated `GET /sync-log`.
- **P2 (aeffe24):** `sync_jobs` outbox with pointer semantics (worker re-reads current state, newest edit wins), `syncItemListingRow` executor extracted to lib/marketplace-sync.ts, in-process worker (5s tick, claim-guarded, 30s·2ⁿ backoff, 5 attempts → failed), and the flip: PATCH /items enqueues instead of calling marketplaces inline. The multi-second photo-edit block is gone.
- **P3 (f07e6fd):** `GET /sync-log/status` + `POST /sync-log/retry`, sync badges + failed-state retry on ListingCard via `useSyncStatus` (polls while pending), `/settings/sync-log` screen with expandable structured errors, More-hub link. Proven with a marketplace-safe DB-seeded e2e on the ephemeral stack; full suite 36 passed / 0 failed; proof screenshots verified and archived.
- **Review round (fdc28c9):** CodeRabbit found 5 real issues, all fixed test-first — stale-running recovery at worker boot, includePhotos OR-coalescing (a title edit could silently drop a queued photo push), etsy fall-through guard, conditionNotes pass-through (pre-existing gap), success-log warning retention. Two suggestions declined with rationale.

Merged as #283 (5 commits). Tests 785→810 API / 590→599 web across the program. Both live containers rebuilt; worker confirmed ticking with recovery.

## Learnings

- Branch protection with strict up-to-date + multiple open PRs = mandatory serial merge chain; update-branch each time, `--auto` doesn't help.
- tdd-guard validator accepts unresolved-symbol failures (ReferenceError from a test run) as license for imports/constants it previously blocked — run the test to generate the evidence instead of arguing.
- dotenv v17 prints an stdout banner that corrupts `$()` captures — `config({quiet: true})`.
- Playwright's HTML reporter output (`playwright-report/`) trips repo-wide eslint with hundreds of errors if left on disk — it's git-ignored but not eslint-ignored.
- The ephemeral e2e stack + direct DB seeding makes marketplace-UI states (failed sync, retry) testable without ever touching live eBay/Reverb.

## Insights

- guard-schema-push.sh ask-prompts resolve as "Denied by user" when unattended — check PreToolUse matchers before reading denials as operator intent.
- Outbox jobs as pointers (not payload snapshots) make coalescing trivial and stale-state pushes impossible: the worker always syncs current DB state.
- CodeRabbit's coalescing catch (photo flag dropped by superseding edits) is the class of bug pointer-semantics alone doesn't fix — flags about *what* to push must be OR-merged, not replaced.

## Deferred

- P4: SKU-based reconcile + mass-sync button (single-flight, worker-driven, slow drip per Reverb ToS)
- P4: per-field sync settings; Auto-Sync/Auto-Publish global toggles
- P4: Reverb order sync + tracking push
- Retire the 08-02 photo-save UI mutex in item-detail after #283 soaks
- CLAUDE.md trio refresh (19 tables now, test counts 810/599, sync architecture section)
