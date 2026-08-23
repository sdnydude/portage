---
title: "Deferral P2: capture-pipeline integrity — landing-verified captures, DLQ durability, write-auth"
sidebar_label: "Deferral P2: capture-pipeline integrity"
sidebar_position: 57
registry_id: 5bbfedca-6d0e-409f-88e5-bfca8a3ae367
---

# Deferral P2: capture-pipeline integrity

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex (3 repos) |
| **TDD** | yes |
| **Branch** | `feat/p2-capture-integrity` (all three repos) |
| **PRs** | [dhg-memreg#1](https://github.com/sdnydude/dhg-memreg/pull/1) · [dhgaifactory3.5#26](https://github.com/sdnydude/dhgaifactory3.5/pull/26) · [portage#313](https://github.com/sdnydude/portage/pull/313) (all merged 2026-08-22) |
| **Registry items** | `7d218492` (critical) · `183474c5` (high) · `166909d3` (fold-in) — all resolved |
| **Tests** | dhg-memreg 216 → 283 · registry +38 P2 tests · agents-cloud +3 |

## What shipped

Every Claude-session capture (insights, decisions, bug-fixes, corrections, ship
sessions, deferred items, test coverage, session reports) is now
**landing-verified and durable**:

- **Write-auth enforcement (live 2026-08-21):** the registry's mutating capture
  routes 401 without `Authorization: Bearer <REGISTRY_WRITE_TOKEN>`. Reads and
  `POST */search` stay LAN-open. Every legitimate writer carries the token
  (memreg scripts/daemon/hooks, docs-ingest CI via file fallback, wiki ingest,
  cloud-agent clients). `/api/v1` coverage deliberately narrowed to
  `agents`/`research` — tokenless antigravity/inference writers stay open.
- **Idempotency rides natural keys** (deviation A): the registry's existing
  per-table unique constraints + upserts are the identity — no new column, no
  migration. Double-fire = one row, proven by direct DB count.
- **Landing verification:** a 2xx without an `id` in the body is not a landing —
  the client dead-letters it. 409 = already-landed. Permanent 4xx are dropped,
  never enqueued.
- **DLQ durability:** all writers serialize on a sibling `.lock` file (never the
  data file — `os.replace` swaps its inode); the replay pass rewrites via
  tempfile + `os.replace`, so a crash mid-rewrite can't wipe the queue.
  Enqueue-dedup, 0600/0700 perms, offline short-circuit (registry-down tick
  costs one probe — deviation B: no per-entry backoff).
- **Timed replay:** every 5 minutes (`DLQ_RETRY_INTERVAL_SECONDS`) independent
  of the 100k-token sweep. `memreg_dlq_depth{pipeline}` +
  `memreg_captures_total{type="dlq_replay"}`.
- **Landing-diff guarantee:** the canonical capture-guarantee V3 runs as a
  user-level Stop hook, verifies candidates against
  `GET /api/captures/lookup` by natural key (corrections include category),
  and fires only what's genuinely missing — under a 2s budget, single
  transcript parse (&lt;5s on 2MB, tested). If it can't finish, a session-end
  marker forces a daemon sweep regardless of token threshold.
- **Cleanup:** six stale portage `post-*.sh` shims + two stale hook copies
  deleted; the canonical dhg-memreg versions (via `~/.claude/scripts`
  symlinks) are the only path.

## Review rigor

Four rounds: 4-advisor spec review (rejected v1's parallel sha256 idempotency
scheme; found write-auth was `off` in prod), 6-agent diff review (caught a
crash-atomicity regression in the first lock fix), 4-advisor final-state round
(dispatch classification parity, triple transcript parse, Mac token footgun).
All 38 + 12 findings fixed in-scope; zero deferrals.

## Live proofs

Registry stopped → capture dead-letters, exit 0, file born 0600. Registry back →
first replay tick lands the row (201), queue drains, `dlq_replay` counter
increments. Identical re-fire → same row id, DB count 1. All 8 pipelines smoke
post-cleanup. Enforce posture: tokenless writes 401 (all mutating verbs), reads
open, lookup 2ms.

## Notes

- Mac: token distributed 2026-08-22 (`bootstrap-mac.sh` now checks and prints
  the scp instruction).
- LangGraph deployment env intentionally gets no token — LangGraph is being
  retired for Pydantic AI + Langfuse (operator direction 2026-08-22); future
  agents consume `REGISTRY_WRITE_TOKEN` via env.
