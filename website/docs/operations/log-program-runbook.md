---
id: log-program-runbook
title: Log Program Runbook
sidebar_position: 9
---

# Log Program Runbook (P5)

The DHG logging foundation after the P5 build (2026-08-25): **Grafana Alloy**
collects every container's stdout on g700data1, redacts secrets at ingest,
and ships to **Loki 3.7.6** (keep-all store). Alerts run in the Loki ruler +
Prometheus, deliver through Alertmanager (v2 API) to the registry incident
webhook. `logs-chat` answers questions over the store — local-only.

## Standing rules

- **Keep-all (operator directive 2026-08-23): nothing deletes log records,
  ever.** `retention_period: 0` and a compactor with retention OFF are the
  *intended* configuration. The only deletion path is the operator-run
  procedure below.
- Redaction masks values in **new** lines at ingest (pino source-side +
  Alloy transport-side); it never drops lines and never touches stored data.

## Components

| Piece | Where | Config |
|---|---|---|
| Alloy (collector) | dhg-alloy | `observability/alloy/config.alloy` (positions on `alloy_data` volume) |
| Loki 3.7.6 | dhg-loki :3100 | `observability/loki/loki-config.yml` (dual schema: boltdb-shipper v11 pre-2026-08-26 UTC, tsdb/v13 after) |
| Ruler alerts (5) | `observability/loki/rules/fake/alerts.yml` | tenant dir is `fake` (auth disabled in Loki 3.x) |
| Prometheus alerts | `observability/prometheus/alerts.yml` group `dhg-logs` | LokiStoreGrowth (20 GB), AlloyDown |
| Store-size gauge | dhg-p5-loki-du sidecar | writes `loki_store_bytes` to the node-exporter textfile dir every 5 min |
| logs-chat | registry `/api/logs/chat` (SSE) | `LOGS_CHAT_TOKEN` bearer; model `granite4.1:8b` local-only |
| Web panel | dhg-frontend `/logs` | streams via `/api/logs-chat` route (token stays server-side) |

## Secret-leak response (SecretLeakDetected fires)

1. **Rotate the credential first.** Never paste the matching log line
   anywhere (chat, ticket, commit).
2. Identify the container from the incident title; find the emitting code.
3. Fix the source, then fix the redaction stage that should have masked it
   (`config.alloy` — the secret must be the **capture group**; the replace
   string is literal; a groupless pattern is a no-op).
4. Re-run the seeded proof: `observability/scripts/p5-seeded-secret.sh`
   must print ALL PASS.
5. The already-stored raw lines stay (keep-all); if the operator wants them
   gone, use the deletion procedure below.
6. Resolve the incident with root cause + prevention filled in.

## Operator-only deletion procedure

Automation never runs this. Precondition: a fresh backup
(`p5-baseline.sh` step 4) and the pre-delete inventory
(`du -sh` by month on the chunk store).

1. Enable the delete API once, temporarily: add
   `compactor.retention_enabled: true` + `delete_request_store: filesystem`
   to `loki-config.yml`, `docker compose restart loki`.
2. Issue a **date-scoped** delete (UTC RFC3339 or epoch):
   `curl -X POST "http://10.0.0.251:3100/loki/api/v1/delete?query=..."`
   with explicit `start`/`end` parameters.
3. Wait for the compactor to process (`GET /loki/api/v1/delete` shows the
   request completed).
4. **Remove the two config keys again** and restart — the store returns to
   keep-all.
5. Record what was deleted and why in a decision log.

## Rollback

- **Loki**: `git checkout` the config + image `grafana/loki:2.9.0` in
  compose; safe only for data before the tsdb cutover (2026-08-26 00:00 UTC)
  — after that, restore the backup tar into the `dhgaifactory35_loki_data`
  volume (wipes post-backup records — **operator-only** under keep-all).
- **Alloy → promtail**: `git revert` the compose change that removed the
  promtail service and `docker compose up -d promtail` (config is in git
  history at `observability/promtail/`).
- **logs-chat**: `git revert` + rebuild registry-api. `alembic downgrade 031`
  drops `logs_chat_audit` **records** — operator-only once real rows exist.

## Drill procedures (all verified live 2026-08-25)

- **LokiStoreGrowth**: lower expr to `> 1048576` and `for: 0m`, restart
  prometheus, expect firing ≤ 1 min and an incident ≤ 2 min; restore both
  values, restart. Resolve the incident as a drill.
- **SecretLeakDetected**: container stdout cannot stage a leak any more
  (Alloy masks at ingest — that is the proof the first drill attempt gives
  you). Push a synthetic raw JWT directly to the push API with
  `container="secretleak-drill"` labels; expect a critical/security incident
  ≤ 2 min; push a second one inside 15 min — it must dedupe (still ONE
  incident). Resolve with the drill note. (No Alertmanager silence: in this
  topology a silence suppresses the webhook — the receiver — entirely; the
  15-min dedup window is the paging guard.)
- **AlloyDown**: `docker compose stop alloy`; `up{job="alloy"}==0` for 5 m
  fires; expect the incident, then `up -d alloy` — json-file buffers replay,
  no loss. Resolve as drill.

## Proofs & baselines

- Retention floor: `p5-baseline.sh` (29-day `count_over_time` > 0).
- Cross-boundary: after 2026-08-26 00:00 UTC, a `[35d]` query must return
  lines from both the boltdb and tsdb periods.
- Seeded secrets: `p5-seeded-secret.sh` → ALL PASS.
- Label parity baseline: `observability/scripts/baselines/labels-pre.json`.
