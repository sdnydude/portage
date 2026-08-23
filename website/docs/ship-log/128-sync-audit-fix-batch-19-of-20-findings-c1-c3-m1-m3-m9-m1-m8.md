---
title: "Sync audit fix batch — 19 of 20 findings (C1-C3, M1, M3-M9, m1-m8)"
sidebar_label: "Sync audit fix batch — 19 of 20 findings (C1-C3, M"
sidebar_position: 128
slug: ship-26032c56
registry_id: 26032c56-b0da-4069-84dd-b0824e55d66a
generated: true
---

# Sync audit fix batch — 19 of 20 findings (C1-C3, M1, M3-M9, m1-m8)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#287](https://github.com/sdnydude/portage/pull/287) |
| **Completed** | 2026-08-03 |
| **Model** | claude-fable-5 |

## Approach

Test-first fix batch on fix/sync-audit-batch: status endpoint dual-source merge + unresolved-failure scope logic, eBay downgrade-retry hardening, transactional enqueue, poll versioning, retry guard+rate limit, worker tenant invariant + re-entrancy + retention sweep, error-leak and e2e injection cleanups

## Commits

- 8e2aef7 fix(sync): audit batch — 19 findings from 2026-08-03 audit

## Decisions

- m3 window query superseded: C2 unresolved-failure detection needs full per-listing job history, retention sweep (30d) bounds the scan instead
- M7 ownership mismatch = terminal job failure, not retry — retries cannot fix ownership

## Review

- Agents: —
- Critical found: 3 · Important found: 9

## Verification

- **lint:** clean (0 errors)
- **tests:** 831 API / 600 web green (+19/+1)
- **typecheck:** pass

**Tags:** `sync`, `audit`, `ebay`, `reverb`, `outbox`, `rate-limit`
