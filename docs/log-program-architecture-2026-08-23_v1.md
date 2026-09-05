# Log Program Architecture — P5 spec session (2026-08-23)

Registry items: `13699992` (retention, high) · `c9c15852` (analysis service, med).
Operator decision 15:35 ET: **Approach A — extend the existing Loki/Grafana
stack.** This document is the P5 deliverable: measured state, the design for
each missing piece, and the build-phase task breakdown. No build in this
session (operator directive 2026-08-08).

## 1. Measured state (2026-08-23)

| Fact | Value |
|------|-------|
| Containers on g700data1 | 59 |
| Total log volume | ≈ 70 MB/day → ≈ 2.1 GB/30d |
| Top writers (24 h) | dhg-loki 13.3 MB · portage-api 9.5 MB · dhg-ollama 8.5 MB · dhg-registry-api 4.5 MB |
| Collection | promtail 2.9 `docker_sd` — **all containers**, labels `container`/`compose_service`/`compose_project`/`level`, healthcheck noise dropped (`observability/promtail/promtail-config.yml`) |
| Storage | Loki 2.9, `retention_period: 744h` (31 d) **with deletes enabled**, data on `/mnt/4tb` (`observability/loki/loki-config.yml:45,67`) |
| Local caps | json-file `max-size 10m × max-file 3` on compose services |
| Dashboards | file-provisioned; `dhg-log-analytics.json` already queries Loki (`observability/grafana/provisioning/dashboards/json/`) |
| Alerting | Loki ruler → Alertmanager → `POST /webhooks/alertmanager` on registry-api → incident rows. 4 Loki rules live incl. `HighErrorRate`, `ContainerErrorSpike` |
| LLM pattern | `registry/talkback_endpoints.py` + `talkback_service.py`: SSE (`citations → delta → done/error`), Ollama local-first (`OLLAMA_URL`, `dhg-ollama`), Haiku fallback |
| **Live secret leak** | **278 JWT-bearing lines in portage-api logs in 48 h** (pino logs `req.headers.authorization`); zero in registry-api/memreg |

Conclusion: storage, retention, collection, dashboards and alert plumbing
already exist. The program is **redaction + proofs + per-container error
dashboard polish + AI log-chat**, not a new log system.

## 2. Redaction design (item `13699992` — the incident driver)

Two layers; both required. Source-side stops the biggest known leak at the
producer; the promtail layer catches every other container, including ones we
don't control (postgres, nginx, third-party images).

### 2.1 Source side — portage-api (pino)

`apps/api` pino config gains first-class redaction:

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
  ],
  censor: '[REDACTED]',
}
```

Acceptance: a request with a Bearer token produces a log line whose
`authorization` field is `[REDACTED]`; the 278/48h count drops to zero for
new lines.

### 2.2 Transport side — promtail pipeline (all containers)

New `replace` stages in `promtail-config.yml`, before the level stage:

| Pattern (case-insensitive) | Replacement |
|---|---|
| `(authorization"?\s*[:=]\s*"?)(?:bearer\s+)?[A-Za-z0-9._~+/-]+=*` | `${1}[REDACTED]` |
| `eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}` (JWT shape) | `[REDACTED_JWT]` |
| `((?:set-)?cookie"?\s*[:=]\s*"?)[^"\s;]+` | `${1}[REDACTED]` |
| `((?:api[_-]?key|token|secret|password)"?\s*[:=]\s*"?)[^"\s,}]+` | `${1}[REDACTED]` |

Notes: replacement happens **before** Loki storage — redacted at rest;
`docker logs` on the host still shows raw lines (bounded to 30 MB/container by
the json-file caps; host access is already root-equivalent). Regexes are
Go RE2 (promtail) — no lookbehind; the `${1}` prefix-capture form above is
RE2-safe.

### 2.3 Proofs (build acceptance for `13699992`)

1. **Seeded-secret proof:** log one line containing a fake JWT + fake
   `Authorization: Bearer` + `password=hunter2` from a throwaway container;
   query Loki; assert every value shows `[REDACTED*]` and the raw value
   returns **zero** Loki hits.
2. **Retention proof:** query a label that existed >31 days ago → empty;
   query 29 days → data (or, faster: read the compactor's deletion logs and
   assert oldest chunk age ≤ 31 d).
3. **Pino proof:** portage-api route test asserting the serialized log
   object redacts `authorization` (unit), plus one live grep-count = 0 on
   fresh traffic.

## 3. Analysis service design (item `c9c15852`)

### 3.1 Dashboard — extend, don't rebuild

`dhg-log-analytics.json` gains (or is replaced by a v2 with): per-container
error-rate panel (`sum by (container) (count_over_time({job="dhg-ai-factory", level=~"ERROR|FATAL|CRITICAL"}[5m]))`),
top-error-containers table (1 h window), live log tail panel with `$container`
+ `$level` variables, and a redaction-health stat (count of `[REDACTED` lines
— proves the pipeline is active). File-provisioned in
`observability/grafana/provisioning/dashboards/json/` so it survives
recreation.

### 3.2 Alerts — already live; one addition

Loki ruler already fires `HighErrorRate` / `ContainerErrorSpike` /
`PostgresFatalError` / `NoLogsFromRegistryApi` into Alertmanager →
registry incidents. Addition: a `SecretLeakDetected` rule — any line matching
the raw JWT shape (i.e. redaction failed or a new leak path appeared):

```yaml
- alert: SecretLeakDetected
  expr: sum(count_over_time({job="dhg-ai-factory"} |~ "eyJ[A-Za-z0-9_-]{8,}\\.eyJ" [15m])) > 0
  for: 0m
  labels: { severity: critical, source: loki }
```

This turns the redaction pipeline into a monitored invariant instead of a
one-time fix.

### 3.3 AI log-chat — copy the talkback pattern

New `registry/logs_chat_endpoints.py` + `logs_chat_service.py`
(+ `logs_chat_schemas.py`), `POST /api/logs/chat`, SSE
(`context → delta → done/error`), registered in `registry/api.py` beside the
talkback router.

Grounding contract (Porter pattern, adapted):
1. Parse the question → build 1–3 LogQL queries (deterministic templates:
   container filter, level filter, time range from the question; a small
   query-builder, **not** LLM-generated LogQL — no injection surface).
2. Run them against `http://loki:3100` (max 500 lines, 30 s budget).
3. Emit the `context` SSE event first: the queries used + line counts
   (citations).
4. Stream the answer from Ollama (`LOGS_CHAT_MODEL`, default
   `granite4.1:8b` — the Porter eval winner; Haiku fallback iff
   `ANTHROPIC_API_KEY` set, same as talkback).
5. **Grounding validation:** every container name and count the answer
   asserts must appear in the retrieved context; a violating answer is
   retried once, then degraded to "context shown, summary unavailable"
   (never a fabricated incident narrative).

Auth: add `/api/logs` to `WRITE_PREFIXES` in `registry/write_auth.py` — log
content is sensitive even redacted; the chat endpoint requires the write
token when enforcement is on.

UI: none in scope for the first build ship. Grafana covers browsing; the
chat is callable from Claude sessions/CLI (curl SSE). A web panel reusing
`frontend/src/components/agents/log-stream.tsx` is a later, separate item.

### 3.4 Acceptance (build phase, from the deferral plan)

- 30 days retention queryable (proof 2.3.2)
- Token redaction proven against a seeded secret line (proof 2.3.1)
- Dashboard live with per-container error rates
- Log-chat answers a real incident question with citations (e.g. the CL=0
  upload burst week of 08-18) and passes the grounding check

## 4. Build task breakdown (next /ship, est. 1 session)

| # | Task | Repo | Risk |
|---|------|------|------|
| B1 | pino `redact` in portage-api + unit test | portage | low |
| B2 | promtail redaction stages + config-lint (`promtail -check-syntax` in the container) | aifactory | med (all-container log path) |
| B3 | Seeded-secret + retention + pino live proofs (scripted, repeatable) | both | low |
| B4 | `SecretLeakDetected` Loki rule + Alertmanager routing check | aifactory | low |
| B5 | `dhg-log-analytics` v2 dashboard JSON | aifactory | low |
| B6 | `logs_chat_*` endpoint triad + LogQL query-builder + grounding validation + tests | aifactory | med |
| B7 | `WRITE_PREFIXES` + docs (runbook section, registry KB ingest) | aifactory | low |
| B8 | Live proof: incident question answered with citations; drill the SecretLeak alert with a seeded line | both | med |

Deploy order: B1 (portage container rebuild) → B2 (promtail restart —
`docker restart dhg-promtail`; positions file preserves tail state) → B3
proofs → B4/B5 (loki ruler + grafana auto-reload) → B6/B7 (registry-api
rebuild) → B8.
Rollback: every piece is a file in git + a container restart; promtail
rollback = revert config + restart (no data loss — Loki keeps what was
already pushed).

## 5. Explicitly out of scope (this program)

- New log storage/table in Postgres (rejected option B — duplicates Loki)
- Web UI for log-chat (later item; Grafana + CLI cover the acceptance)
- Changing json-file caps or the Loki retention window (already correct)
- Log shipping off-host / backups (not in the registry items)
