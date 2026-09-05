---
title: "Marketplace sync refactor — durable log, outbox worker, UI truth surface (P0-P3)"
sidebar_label: "Marketplace sync refactor — durable log, outbox wo"
sidebar_position: 127
slug: ship-21611579
registry_id: 21611579-3a28-4c1f-919e-a785c65103c7
generated: true
---

# Marketplace sync refactor — durable log, outbox worker, UI truth surface (P0-P3)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#283](https://github.com/sdnydude/portage/pull/283) |
| **Completed** | 2026-08-03 |
| **Model** | claude-fable-5 |

## Approach

4-phase rebuild per approved whats-next_v4.md plan: P0 contract unification (warnings surfaced, shared enrichment, soft-warn, photo diff), P1 marketplace_sync_log table + GET /sync-log, P2 sync_jobs outbox + in-process worker with PATCH /items enqueue flip, P3 badges + settings sync-log screen + retry. TDD throughout under tdd-guard; ephemeral-stack e2e proof.

## Commits

- e6c2e16 fix(sync): P0 contract unification for marketplace edit-sync
- c618da7 feat(sync): P1 durable sync log — table, writes, GET /sync-log
- aeffe24 feat(sync): P2 outbox worker — sync_jobs queue + async item edit-sync
- f07e6fd feat(sync): P3 UI truth surface — badges, sync log screen, retry

## Deferred Items

- P4: SKU-based reconcile + mass-sync button (single-flight, worker-driven)
- P4: per-field sync settings + Auto-Sync/Auto-Publish global toggles
- P4: Reverb order sync + tracking push
- Retire the 08-02 photo-save UI mutex now that photo sync is async

## Decisions

- listings.ts PATCH stays inline (cheap after photo omit, keeps listing-card immediate feedback); items.ts is the async outbox path
- sync_jobs are pointers not snapshots — worker re-reads current state, newest edit naturally wins
- in-process setInterval worker over external queue infra (single-server deployment)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (0 errors)
- **tests:** 805 API / 599 web green; e2e 36 passed 0 failed (ephemeral stack)
- **typecheck:** pass

**Tags:** `reverb`, `sync`, `outbox`, `sync-log`, `marketplace`
