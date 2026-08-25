---
title: "Deferral P5 build — Loki 3.7.6 + Alloy keep-all foundation, redaction, alert revival, logs-chat"
sidebar_label: "Deferral P5 build — log program"
sidebar_position: 136
slug: ship-eabb7b57
registry_id: eabb7b57-00a7-4708-ac66-92f0f1ed58e4
---

# Deferral P5 build — log program

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes (portage T6) |
| **PRs** | dhgaifactory3.5 #27 · portage #325 |
| **Completed** | 2026-08-25 |
| **Model** | claude-fable-5 |

The build phase of the P5 log program (spec: ship-log 135). Thirteen tasks
across two repos, executed against the operator-approved rev-3 architecture
with eight advisor/review rounds end to end.

## What shipped

- **Loki 2.9.0 → 3.7.6, treated as a fresh install** (operator amendment):
  dual schema (boltdb-shipper v11 kept for all pre-2026-08-26 data, tsdb/v13
  from the UTC cutover), `retention_period: 0` as explicit keep-all,
  compactor with retention OFF, top-level ruler config corrected live
  (nested form is the operative one without Thanos objstore), rules moved to
  the `fake` tenant dir (3.x auth-off change).
- **Ruler → Alertmanager v2** — fixed a production black hole found by the
  operator-mandated wiring verification: every ruler notification had 410'd
  since Alertmanager v0.27 (13,652 dropped); all four legacy alerts had
  never delivered.
- **promtail (EOL 2026-03-02) → Grafana Alloy v1.19** with ingest
  redaction. The seeded-secret proof caught that Alloy's `stage.replace`
  inverts promtail semantics (capture group replaced with a literal, no
  `${1}`, groupless = no-op) — stages restructured secret-as-group, proof
  ALL PASS. Positions persist on a volume; label parity verified against a
  pre-migration baseline; healthcheck noise dropped at ingest (approved).
- **portage pino redact** (TDD, five red→green cycles): authorization,
  cookie, both CF Access headers, set-cookie — live-proven `[REDACTED]` in
  container logs.
- **Alerting**: SecretLeakDetected (fired for real on the broken first
  proof run — chain proven ahead of its drill), LokiStoreGrowth (20 GB
  watermark on a sidecar-fed `loki_store_bytes` gauge), AlloyDown, LokiDown
  — trigger map T14–T17, every alert live-fire drilled to a registry
  incident and closed out.
- **logs-chat**: local-only granite4.1:8b SSE endpoint — deterministic
  LogQL, fuzzy container resolution, container grounding (context-quoted
  names allowed), 45 s budget with heartbeats, dedicated `LOGS_CHAT_TOKEN`,
  immutable audit rows (alembic 032). **`/logs` panel** in dhg-frontend:
  first streaming proxy route (the generic proxy buffers), mc-token
  terminal panel, honest degraded states — browser-proven.
- **Runbook** (`operations/log-program-runbook`): keep-all statement,
  secret-leak response, operator-only deletion procedure, rollbacks,
  verified drill procedures.

## Defects caught by the process

Alloy replace-semantics inversion (seeded proof); River escaping crash-loop
(validate gate); Loki 3.x `service_name` auto-label (parity gate); registry
crash-loop from an async-generator `return` (3 min, live); LogStream
follow-scroll yanking the page (screenshot inspection); gitignore
swallowing the /logs page (commit stat); grounding false-positives on
quoted container names (SSE smoke); 7 ruff errors (CI).

## Verification

portage 1038/1038 + typecheck/lint · registry 15 + 33 tests, P5 files
ruff-clean · 5-agent Phase 6 review + pre-merge advisor (4 admin blockers
cleared; zero code/plan/keep-all violations) · cross-boundary [35d] proof
runs post-cutover tonight as post-merge verification (operator call).

**Tags:** `loki`, `alloy`, `redaction`, `logs-chat`, `alerts`, `keep-all`, `deferral-p5`
