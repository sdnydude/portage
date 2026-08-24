---
title: "Deferral P5 — log program spec (keep-all retention, redaction, analysis service, B0-B9)"
sidebar_label: "Deferral P5 — log program spec"
sidebar_position: 135
slug: ship-2b1d29bd
registry_id: 2b1d29bd-8f80-46d5-b929-7079a8d6f519
---

# Deferral P5 — log program spec (keep-all retention, redaction, analysis service, B0-B9)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | n/a (spec session) |
| **PR** | docs-only (spec doc) |
| **Completed** | 2026-08-23 |
| **Model** | claude-fable-5 |

Spec-only session per `docs/deferral-plan-2026-08-15.md` §P5, covering registry
items `13699992` (log retention) and `c9c15852` (log analysis service).
Deliverable: `docs/log-program-architecture-2026-08-23.md` (rev 3, approved
16:12 ET) + B0–B9 build task breakdown for the next /ship.

## Approach

Approach A: extend the existing Loki 2.9 / promtail / Grafana stack — no new
log store. Rev 3 landed after five advisor reviews across two rounds
(3 spec advisors, then a completeness advisor + an adversarial fact-checker
that re-measured the live system: 21 claims verified, 2 refuted and fixed).

Mid-session operator directive reshaped retention at the root: **keep all
records; only the operator deletes records.** B0 became a growth alert
(20 GB) + a 29-day floor-proof query + a documented operator-only deletion
procedure — the compactor's retention stays off by intent.

## Key spec content

- 2-layer redaction: pino `redact` (5 paths, including the
  `cf-access-authenticated-user-email` header the fact-check found logged
  verbatim) + 6 promtail replace stages (RE2-verified; the rev-2 markdown
  table had corrupted 3 of them with escaped pipes — patterns now live in
  code blocks only)
- Analysis service: 2 new Grafana panels, `SecretLeakDetected` +
  `LokiStoreGrowth` rules with `ALERT_TRIGGER_MAP` entries and a silenced
  drill procedure, log-chat (local-only Ollama, SSE, 45 s budget, audit
  rows, nginx `/api/logs/` 120 s location block)
- B0–B9 build tasks with per-task acceptance, deploy order, rollback

## Operator rulings (16:12 ET)

1. No deferrals — log-chat web panel is B9 (dhg-frontend, reuse log-stream.tsx)
2. Healthcheck ingest-drop approved (58.8 % of portage-api volume)
3. Already-stored secret lines left in place (LAN-only store)

## Decisions

- keep-all retention: growth alert + operator-only manual deletion, over compactor retention_enabled
- log-chat local-only, no cloud fallback; dedicated LOGS_CHAT_TOKEN + audit rows
- promtail redaction patterns kept in code blocks, never markdown tables (escaped-pipe corruption class)
- B9 web panel built, not deferred (operator ruling)
- healthcheck lines dropped at ingest going forward (operator approved)
- stored secret lines left for operator disposition

**Tags:** `logs`, `loki`, `promtail`, `redaction`, `retention`, `observability`, `spec`, `deferral-p5`
