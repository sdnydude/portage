# Log Program Architecture — P5 spec session (2026-08-23, rev 2)

Registry items: `13699992` (retention, high) · `c9c15852` (analysis service, med).
Operator decision 15:35 ET: **Approach A — extend the existing Loki/Grafana
stack.** Rev 2 folds in the 3-advisor review (ops vs live configs, security,
LLM grounding) — 16 corrections, two of them measured false premises in rev 1.
No build in this session (operator directive 2026-08-08). v1 archived beside
this file.

## 1. Measured state (2026-08-23, disk-verified)

| Fact | Value |
|------|-------|
| Containers on g700data1 | 59 |
| Total log volume | ≈ 70 MB/day → ≈ 2.1 GB/30d |
| Top writers (24 h) | dhg-loki 13.3 MB · portage-api 9.5 MB · dhg-ollama 8.5 MB · dhg-registry-api 4.5 MB |
| Collection | promtail 2.9 `docker_sd` — all containers, labels `container`/`compose_service`/`compose_project`/`level` |
| **Retention: NOT enforced** | `retention_period: 744h` is configured but there is **no compactor `retention_enabled`** — for boltdb-shipper the `table_manager` flags are a no-op. **Disk truth: oldest chunk 2026-02-03 (≈ 6.5 months), 1.7 GB and growing unbounded.** Rev 1 claimed "deletes enabled" from the config; the disk says otherwise. |
| **Healthcheck filter: no-op for pino** | promtail's drop stage matches `"GET /health "` combined-log text; pino logs `"url":"/health"` as JSON — **58 % of portage-api's lines (1,162 of 2,000 sampled) are health checks that pass the filter** |
| Local caps | json-file `max-size 10m × max-file 3` |
| Dashboards | `dhg-log-analytics.json` already has the top-error-containers table (panel 5) and a `$container`/`$level` log tail (panel 105) |
| Alerting | Loki ruler → Alertmanager → `POST /webhooks/alertmanager` → incidents; 4 rules live. `ALERT_TRIGGER_MAP` in `registry/api.py` is a hardcoded allowlist — un-mapped alerts create non-deduplicatable incidents |
| LLM pattern | `registry/talkback_*`: SSE `citations → delta → done/error`, Ollama local-first, Haiku fallback. **Deployed Ollama context = 16,384 tokens** (`OLLAMA_CONTEXT_LENGTH` env), not the model card's 131 k |
| **Live secret leak** | 278 JWT-bearing lines in portage-api logs / 48 h (pino logs `req.headers` verbatim; also logs `email` on login, and `cf-access-jwt-assertion` on every request) |
| pino log line size | http-completed lines 1,150–1,400 chars (≈ 300–350 tokens) — dominated by header dumps |

## 2. Retention fix (item `13699992` part 1) — NEW, was missing from rev 1

`observability/loki/loki-config.yml` gains a compactor stanza:

```yaml
compactor:
  working_directory: /loki/compactor
  shared_store: filesystem
  retention_enabled: true
  retention_delete_delay: 2h
  compaction_interval: 10m
```

Acceptance: after one compaction cycle + delete delay, `find /loki/chunks`'s
oldest file is ≤ 31 days old (script asserts it); disk usage drops from
1.7 GB accordingly. This is the retention proof — chunk ages on disk, not a
query (query-empty checks depend on compactor timing and can lie).

Also fixed here: the healthcheck drop stage gains a JSON-aware expression
(`"url"\s*:\s*"/(health|ready|metrics)` alongside the existing combined-log
form) so pino health noise stops inflating Loki (58 % of portage-api volume)
and stops polluting log-chat context.

## 3. Redaction design (item `13699992` part 2 — the incident driver)

Two layers, both required.

### 3.1 Source side — portage-api (pino)

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["cf-access-jwt-assertion"]',   // the actual CF credential, read on /auth/session
    'res.headers["set-cookie"]',                 // array-valued: pino censors the whole path
  ],
  censor: '[REDACTED]',
}
```

Known, accepted gaps at this layer (the promtail layer covers shapes, and no
current route puts secrets there — verified): `req.url`/`req.query` are
logged raw; third-party error bodies (e.g. eBay token-exchange failures) are
free text with no guarantee.

### 3.2 Transport side — promtail `replace` stages (all containers)

All patterns **must** carry inline `(?i)` — RE2 has no external flag, and the
capitalized `Authorization:` / `Password` forms are exactly what nginx and
third-party images emit (rev 1 claimed case-insensitivity without it).

| Pattern | Replacement |
|---|---|
| `(?i)(authorization"?\s*[:=]\s*"?)(?:bearer\s+)?[A-Za-z0-9._~+/-]+=*` | `${1}[REDACTED]` |
| `eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}` | `[REDACTED_JWT]` |
| `(?i)((?:set-)?cookie"?\s*[:=]\s*"?)[^"]+` | `${1}[REDACTED]` — consumes the whole header value; the rev-1 `[^"\s;]+` tail left every cookie after the first `;` in clear text |
| `(?i)((?:api[_-]?key\|token\|secret\|password)"?\s*[:=]\s*"?)[^"\s,}]+` | `${1}[REDACTED]` |
| `(?i)([?&](?:code\|state\|access_token\|id_token)=)[^&\s"]+` | `${1}[REDACTED]` — OAuth codes in URLs (nginx/cloudflared access lines) |
| `dp\.(?:st\|ct\|pt)\.[A-Za-z0-9_-]{10,}` | `[REDACTED_DOPPLER]` |

Accepted false positive: a prose line like `password: too short` gets its
tail redacted — cosmetic; false negatives are the incident class, false
positives are not.

`${1}` is Go `regexp.Expand` syntax (distinct from the `template` stage's
`{{ }}`) — believed correct, **but B2 is not done until the seeded-secret
proof passes**; `promtail -check-syntax` validates schema, not substitution.

### 3.3 Proofs

1. **Seeded-secret:** one throwaway container logs a fake JWT + `Authorization:
   Bearer x` + `Cookie: a=1; b=2` + `?code=x` + `dp.st.x…` + `password=hunter2`;
   Loki shows every value `[REDACTED*]`; raw values return zero hits.
2. **Retention:** oldest chunk file ≤ 31 d (scripted, §2).
3. **Pino:** unit test on the serialized log object (authorization,
   cf-access-jwt-assertion, set-cookie all `[REDACTED]`) + live grep-count 0
   on fresh traffic.

## 4. Analysis service design (item `c9c15852`)

### 4.1 Dashboard — two genuinely new panels only

`dhg-log-analytics` already has the top-error table and the filtered live
tail (rev 1 would have duplicated both). New: (a) per-container error-**rate**
timeseries (`sum by (container) (count_over_time({job="dhg-ai-factory", level=~"(?i)error|fatal|critical"}[5m]))`),
(b) redaction-health stat (count of `[REDACTED` lines — proves the pipeline
is alive).

### 4.2 Alerts — one addition, correctly wired

```yaml
- alert: SecretLeakDetected
  expr: sum by (container) (count_over_time({job="dhg-ai-factory"} |~ "eyJ[A-Za-z0-9_-]{8,}\\.eyJ" [15m])) > 0
  for: 0m
  labels: { severity: critical, source: loki }
  annotations:
    summary: "Unredacted credential shape in {{ $labels.container }} logs"
    description: "Redaction failed or a new leak path appeared. Rotate the credential; investigate by container/timestamp only."
```

Plus the piece rev 1 missed: an `ALERT_TRIGGER_MAP` entry in
`registry/api.py` (`category: security`) — without it the incident cannot
dedup and a persistent leak spawns a new incident row every 4 h.
Metric-only rule: the matched line's content never reaches Alertmanager (no
secondary leak). Runbook line: **rotate first; never paste the matching line
into an incident, chat, or screenshot.**
Self-trigger check: the seeded proof and the dashboard stat search for
`[REDACTED` — cannot match the raw-JWT shape.

### 4.3 AI log-chat — talkback pattern, with the grounding lessons applied

`registry/logs_chat_{endpoints,service,schemas}.py`, `POST /api/logs/chat`,
SSE `heartbeat → context → delta → done/error`.

1. **Query building.** Deterministic templates for container / level / time
   range. Fuzzy references ("the API", "the upload burst") resolve via the
   live container list (`label_values({job="dhg-ai-factory"}, container)`)
   using Porter's `normalize()` word-containment match; if still unresolved,
   one constrained intent-extraction LLM call whose output MUST be a member
   of that list plus a time range — validated before any LogQL is built
   (never LLM-generated LogQL).
2. **Context budget.** Deployed context is 16 k tokens: cap retrieved
   context at **≤ 8,000 tokens**, not a line count; each line is stripped to
   `timestamp level container msg` (the pino header blob is noise). Loki
   query phase emits a `heartbeat` event every 5 s (it can take up to 30 s;
   nginx allows 300 s).
3. **Citations first.** The `context` event carries the exact LogQL queries
   and per-query line counts — the authoritative numbers.
4. **Answer, buffered.** Ollama `LOGS_CHAT_MODEL` (default `granite4.1:8b`).
   The answer is **buffered server-side, grounding-validated, then streamed**
   (Porter's model — a live token stream cannot retract an ungrounded
   sentence). One retry on violation, then degrade to a dedicated
   `degraded` event: context shown, summary unavailable.
5. **Grounding rule — container names only.** Porter's fuzzy word-containment
   check against the label list. **No numeric/count validation in prose**
   (Porter's own 2026-08-11 false-positive incident is why); counts come from
   the `context` event, and callers surface those directly.
6. **Cloud egress: none.** Logs carry PII the redaction layers do not target
   (login emails, shipping addresses). Log-chat is **local-only — the Haiku
   fallback is disabled for this endpoint**; if Ollama is down the endpoint
   returns `error` with the context still attached. (Operator may later
   choose a scrubber + cloud fallback; that is a separate decision.)
7. **Auth + audit.** `/api/logs` joins `WRITE_PREFIXES`, and the endpoint
   uses a **dedicated token** (`LOGS_CHAT_TOKEN`, separate secret from the
   general write token — holding "can post a decision log" must not grant
   natural-language access to the log corpus). Every call writes an audit
   row: caller, question, queries run, timestamp — never the answer body.

UI: out of scope for the first build (Grafana + CLI cover acceptance).

### 4.4 Acceptance (build phase)

- Oldest Loki chunk ≤ 31 d (disk-verified) — §2
- Seeded multi-shape secret line fully redacted; raw values zero hits — §3.3
- Dashboard v2 live (error-rate + redaction-health panels)
- `SecretLeakDetected` fires in a drill (seeded raw JWT bypassing promtail via
  direct Loki push), creates ONE deduplicated security-category incident
- Log-chat answers a real incident question with citations, passes container
  grounding, refuses cloud egress (assert no Anthropic call), writes an audit row

## 5. Build task breakdown (next /ship)

| # | Task | Repo | Risk |
|---|------|------|------|
| B0 | Loki compactor stanza (retention actually enforced) + chunk-age proof script | aifactory | **high** (touches the store; existing 6.5-month backlog will be deleted — confirm nothing needs archiving first, operator call) |
| B1 | pino `redact` (4 paths) + unit test | portage | low |
| B2 | promtail redaction stages (6 patterns, all `(?i)` where applicable) + JSON healthcheck drop fix; done only when B3's seeded proof passes | aifactory | med |
| B3 | Seeded-secret + chunk-age + pino proofs (scripted, repeatable) | both | low |
| B4 | `SecretLeakDetected` rule + annotations + `ALERT_TRIGGER_MAP` entry (registry/api.py, category security) + dedup check | aifactory | med |
| B5 | Dashboard v2: error-rate panel + redaction-health stat (only) | aifactory | low |
| B6 | `logs_chat_*` triad: query builder + fuzzy container resolution + 8k-token context assembly + buffered grounding + local-only + audit rows + tests | aifactory | med |
| B7 | `WRITE_PREFIXES` + `LOGS_CHAT_TOKEN` + runbook section (incl. leak-response line) + KB ingest | aifactory | low |
| B8 | Live proof: incident question with citations; SecretLeak drill; no-cloud assertion | both | med |

Deploy order: B0 (after operator confirms the pre-2026-07 logs can be
deleted) → B1 (portage rebuild) → B2 (promtail restart; positions file
survives `docker restart` — footnote: bind-mount it before any container
*recreation*) → B3 → B4/B5 → B6/B7 (registry rebuild) → B8.
Rollback: config files in git + container restarts; compactor rollback stops
future deletion but cannot restore deleted chunks — hence the operator gate
on B0.

## 6. Decisions taken in this spec (operator-approved with the doc)

1. Approach A (15:35 ET).
2. Log-chat is **local-only** — no cloud fallback while logs can carry PII.
3. Log-chat uses a **dedicated token** + per-call audit rows.
4. Grounding validates container names only; counts come from the context
   event (Porter incident lesson).
5. Buffered-then-stream answer delivery (retractability over typing feel).
6. B0 deletes the pre-existing 6.5-month log backlog — **operator must
   confirm** nothing in it needs archiving before the build ship runs B0.

## 7. Explicitly out of scope

New Postgres log store (rejected B); log-chat web UI; changing caps or the
31-day window itself; off-host shipping/backups; PII scrubbing at rest
(targeted redaction only — a broader PII program would be its own item).
