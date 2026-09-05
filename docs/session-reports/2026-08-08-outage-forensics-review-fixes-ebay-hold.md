# Session report — outage forensics, review-fix marathon, eBay hold #2 (2026-08-07 evening → 2026-08-08 morning)

Fresh session picked up from a stuck predecessor (session_01Sx5ECXU18Bgw617nTJ3doi, context-blown) mid Ship-program Phase 2 (marketplace-truth sync, branch `fix/marketplace-truth-sync`, everything uncommitted).

## Arc 1 — Where did the stuck session leave off, and what were "the failures"?

Ship-state said phase 4; journal said Phase 2 LIVE-PROVEN with a 3-reviewer round complete. Verified fresh: 899/899 api, typecheck clean. Then the operator reported "many errors in the last session's tasks." Forensics found 12 `order_sync` failure rows, every marketplace, "fetch failed" — and a first-draft timeline placed them at 13:15–15:30 ET until reconciliation against pino epoch-ms timestamps exposed a +4h skew: `marketplace_sync_log.created_at` is timestamp-without-timezone and ad-hoc postgres.js queries parse it as host-local ET. Real window: 09:15–11:30 ET. `journalctl -k` then produced the cause: `eno1` (r8169) link DOWN 09:14:39 → UP 11:43:38. Operator confirmed: a network switch lost power. The whole host was offline 2.5h; every marketplace call died at DNS (`EAI_AGAIN`); nothing reached eBay/Reverb. Phase 2's failure handling passed this accidental chaos test — durable failure rows, zero false state flips (unknown=no-op held), auto-recovery cycle imported Reverb order 26204093 and flipped its listing sold.

The stuck session's three failed background tasks (teardown-from-root verify, dripguard verify, green check + full suites) were verification runs that died with the session. Re-verified all three: dripguard exists with its overlap test (sync-worker.ts:128, test :520), stopSyncWorker clears all 5 timers + queue across 7 test callsites, and fresh full suites ran green.

## Arc 2 — Review round: 7 findings, 7 fixed, same session

Two agents (marketplace-adapter-reviewer, feature-dev:code-reviewer) on the Phase 2 diff:

1. Reverb `getOrders` had no pagination → HAL `_links.next` loop, MAX_PAGES 10 (eBay posture).
2. Unguarded `order.amount_product.amount` → per-order guard, skip+warn (test reproduced the exact TypeError red).
3. Backfill title "eBay item N" for Reverb orders → marketplace-generic + Reverb `title` now mapped.
4. Untrusted response fields typed required → all optional.
5. No failure-mode tests → 3 added.
6. TOCTOU: periodic cycle vs manual POST /orders/sync double-insert → `uq_orders_user_marketplace_order` unique index (pushed live, 0 dups) + `onConflictDoNothing().returning()` empty-skip. tdd-guard correctly rejected bundling the schema change into the red phase; code first, index after green.
7. First-import of an already-canceled order flipped its listing to sold → gated on `fulfillmentStatus !== 'canceled'`.

Live shape verification against the real Reverb shop (read-only) exposed bonus mapping gaps the reviewers missed: the payload carries `title`, `paid_at`, `status` (vocab: `shipped`/`cancelled` — British spelling), `selling_fee` — all previously dropped, so every imported order had sync-time soldAt, fees=0, payment_received status (a live cancelled order sat in the ship queue). All mapped. Container rebuilt; boot cycle healed everything: 17/17 orders (2 stragglers imported), fees match the API to the cent, real sale dates, cancelled order out of the queue. Final gates: 905/905 api (+6), 631/631 web, typecheck clean.

## Arc 3 — eBay payout hold #2

Operator woke 08-08 to all payouts held 30 days — second hold in 11 days; July's (07-28, OAuth-repair false positive) was resolved 08-02 after a documented support email. 24h forensics: zero failed sign-ins, zero auth errors, no third-party access. Candidate signals only: the new sweep polling pattern (~650 GetItem reads/day since 08-07 05:30) and 2 duplicate-listing warnings on same-model SSDs that are physically distinct units with individual health reports. The operator's 06:51 OAuth reconnect was a post-hold reaction. eBay support declines to disclose hold reasons (security practice).

Deliverables: new Docusaurus section `website/docs/ebay-support/` (both payment-hold docs moved in, links fixed, category index) holding: the long support email (with Portage intro, duplicate-listing explanation, no-reason framing), a 999-char short-form support message (3 revisions archived; final asks for restore to 2-day post-delivery payouts, "on-premises server" wording), a community-mentor post (3 revisions; de-slopped to forum voice), and the forensic investigation writeup. Private artifact published and kept current through every revision.

## Arc 4 — Logging program born

The 08-07 daytime container logs were unrecoverable (json-file driver dies with the container on rebuild), which blinded part of the forensics. Operator directed: Phase 8 added to the ship program — 8.1 30-day container-log retention into a dhg-aifactory registry table with search/knowledge processing (llmwiki-ready); 8.2 a log aggregation/reporting/analysis service with web UI dashboard, live stats, and an AI log-chat assistant. Both registry-filed (13699992, c9c15852).

## Learnings

- `marketplace_sync_log.created_at` is timestamp-without-tz; postgres.js ad-hoc reads display +4h skew on this host. Pino epoch-ms timestamps are the clock of record — reconcile before building any timeline.
- Reverb order payload vocabulary is live-verified: status `shipped`/`cancelled` (British), `paid_at` nullable on cancelled orders, `selling_fee` absent on cancelled, `_links.next.href` absolute-URL pagination.
- Docker json-file logs die with the container: any rebuild during an incident destroys the forensic window. Durable DB sync-log rows were the only surviving worker record.
- tdd-guard's over-implementation rejection was correct: the unit test only drove the code path; the schema index is a deploy-level counterpart added after green.

## Insights

- A 2.5h total network outage is a free chaos test: the worker's unknown=no-op rule, durable failure rows, and in-flight guards all proved themselves against real infrastructure failure rather than mocks.
- One malformed order aborting a whole user's order batch (single try/catch around the marketplace loop) is a systemic shape worth checking in every adapter's list-mapping code.

## Deferred

- Phase 8.1 30-day log retention → dhg-aifactory registry (id 13699992, operator-approved 08-08).
- Phase 8.2 log aggregation/reporting service + dashboard + AI log chat (id c9c15852, operator-approved 08-08).

## End state

Branch `fix/marketplace-truth-sync`, zero commits, all work uncommitted and live-deployed. Next: review record + commit + PR (operator approval), then ship-program Phase 3a. eBay hold awaits eBay's response; operator sends the short-form message.
