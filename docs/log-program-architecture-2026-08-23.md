# Log Program Architecture — P5 spec session (2026-08-23, rev 3)

Registry items: `13699992` (retention, high) · `c9c15852` (analysis service, med).
Rev 3 = rev 2 + the second advisor round (adversarial fact-check with live
re-measurement; completeness vs the P5 plan text) + the operator's standing
directive (16:06 ET): **keep all records — the operator is the only person
who deletes records.** v1/v2 archived beside this file.

Operator decisions embedded: Approach A (15:35) · keep-all/operator-only
deletion (16:06). Open approvals listed in §8.

## 1. Measured state (2026-08-23, independently re-verified)

| Fact | Value |
|------|-------|
| Containers | 59 running |
| Volume | ≈ 69–70 MB/day → ≈ 2.0–2.1 GB/30d → ≈ 25 GB/yr (4 TB mount) |
| Top writers (24 h) | dhg-loki ~14 MB · portage-api ~10 MB · dhg-ollama ~8.6 MB · dhg-registry-api 4.5 MB |
| Collection | promtail 2.9 `docker_sd`, all containers, labels `container`/`compose_service`/`compose_project`/`level` |
| Retention | `retention_period: 744h` configured but **not enforced** (no compactor `retention_enabled`; `table_manager` flags are a no-op for boltdb-shipper). Chunk store: 1.7 GB, 38,019 files, **oldest real chunk 2026-04-06** (the Feb 3 file is `loki_cluster_seed.json`, not a chunk). Under the keep-all directive this non-enforcement is now the **intended** state. |
| Healthcheck filter | no-op for pino JSON: 58.8 % of portage-api lines (1,176/2,000 re-sampled) are `"url":"/health"` and pass the drop stage |
| Local caps | json-file `10m × 3` set **globally in `/etc/docker/daemon.json`** — the P5 plan's "Docker logging-driver caps" item is already shipped (evidence, not descope) |
| Dashboards | `dhg-log-analytics.json` panel 5 = top-error table; row 105/panel 50 = `$container`/`$level` log tail |
| Alerting | Loki ruler (4 rules) → Alertmanager (`repeat_interval: 4h`) → registry `/webhooks/alertmanager` → incidents. `ALERT_TRIGGER_MAP` = hardcoded 12-entry allowlist; un-mapped alertnames → `trigger_rule=None` → `find_duplicate()` short-circuits → **cannot dedup** |
| Proxy | The live nginx (`docs-site/nginx.conf`, mounted) caps generic `/api/` at **30 s** `proxy_read_timeout`; `/api/talkback` has a hand-carved 120 s block. `infrastructure/nginx.conf` (300 s) is an unmounted orphan — rev 2 cited it wrongly. |
| LLM | talkback SSE `citations → delta → done/error`; Ollama local-first; deployed context **16,384 tokens** (`OLLAMA_CONTEXT_LENGTH`) |
| Secret/PII leaks (48 h, counts only) | 278 JWT-bearing lines (exact re-count); `cf-access-jwt-assertion` on CF-proxied requests (~0.4 % of lines); **`cf-access-authenticated-user-email` header logged verbatim on every CF-proxied request** (33/9,019 — found by the fact-check, missing from rev 2); `email` logged once per first-login provision (`auth.ts:117`) |
| pino line size | request-completed lines 1,198–1,364 chars (median 1,237) |

## 2. Retention (item `13699992` part 1) — keep-all design (operator directive 16:06)

**No automatic deletion, anywhere.** The compactor's retention stays
disabled; the Apr-onward backlog is kept. "30-day retention queryable"
becomes a **floor**: it is satisfied because nothing is ever deleted.

Build pieces:

1. **Floor proof:** `count_over_time({job="dhg-ai-factory"}[29d])` > 0 for a
   sampled container (repeatable script). Both directions covered: floor by
   query, ceiling intentionally unbounded.
2. **Growth watch:** Prometheus alert `LokiStoreGrowth` when `/loki` exceeds
   20 GB (≈ 10× today; ~2 years of headroom at current volume) — a prompt
   for the operator to *decide*, never an action.
3. **Operator-only deletion procedure** documented in the runbook: how the
   operator (alone) would prune by date range using Loki's delete API /
   compactor one-shot, with the pre-delete inventory step below. Automation
   never invokes it.
4. **Healthcheck drop fix:** promtail drop stage gains a JSON-aware
   expression (`"url"\s*:\s*"/(health|ready|metrics)`) beside the
   combined-log form — 58 % of portage-api volume is health noise. (Noise
   reduction, not record deletion: these lines are dropped at ingest going
   forward; nothing stored is touched. Flagged for §8 approval since the
   directive says keep all records — dropping *future* health-check pings is
   a judgment call that belongs to the operator.)

Current store inventory (pre-existing chunks, kept):

| Month | Size | Chunks |
|-------|------|--------|
| 2026-04 | 235.6 MB | 6,025 |
| 2026-05 | 345.1 MB | 9,097 |
| 2026-06 | 304.7 MB | 8,175 |
| 2026-07 | 433.2 MB | 8,226 |
| 2026-08 | 332.3 MB | 6,496 |

## 3. Redaction design (item `13699992` part 2 — the incident driver)

Unchanged in structure from rev 2; patterns corrected after the fact-check
(the rev-2 markdown table's `\|` escapes were **literal pipes in RE2** —
three of six patterns would have silently matched nothing; the corrupted
forms even pass `promtail -check-syntax`).

### 3.1 Source side — portage-api (pino)

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["cf-access-jwt-assertion"]',
    'req.headers["cf-access-authenticated-user-email"]',  // logged on every CF-proxied request (fact-check find)
    'res.headers["set-cookie"]',
  ],
  censor: '[REDACTED]',
}
```

Accepted gaps at this layer: `req.url`/`req.query` raw (no current route
carries secrets there — verified); third-party error bodies best-effort only.

### 3.2 Transport side — promtail `replace` stages

Written here as plain code lines, not a table, so no markdown escaping can
corrupt them again:

```yaml
# 1
- replace: { expression: '(?i)(authorization"?\s*[:=]\s*"?)(?:bearer\s+)?[A-Za-z0-9._~+/-]+=*', replace: '${1}[REDACTED]' }
# 2
- replace: { expression: 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}', replace: '[REDACTED_JWT]' }
# 3 — whole header value; a ;-bounded tail leaves later cookies in clear text
- replace: { expression: '(?i)((?:set-)?cookie"?\s*[:=]\s*"?)[^"]+', replace: '${1}[REDACTED]' }
# 4
- replace: { expression: '(?i)((?:api[_-]?key|token|secret|password)"?\s*[:=]\s*"?)[^"\s,}]+', replace: '${1}[REDACTED]' }
# 5 — OAuth codes in URLs (nginx/cloudflared access lines)
- replace: { expression: '(?i)([?&](?:code|state|access_token|id_token)=)[^&\s"]+', replace: '${1}[REDACTED]' }
# 6 — Doppler token shapes
- replace: { expression: 'dp\.(?:st|ct|pt)\.[A-Za-z0-9_-]{10,}', replace: '[REDACTED_DOPPLER]' }
```

All six compile in RE2 (`promtail -check-syntax` verified by the fact-check
against the corrected forms). Accepted false positive: prose like
`password: too short` loses its tail — cosmetic. `${1}` is Go
`regexp.Expand` syntax; **B2 is done only when the seeded proof passes** —
syntax-check cannot validate substitution.

Redaction masks values in *new* lines at ingest; it deletes nothing
(directive-compatible). Historical stored lines keep their content — the
operator-only deletion procedure is the sole remedy for the already-stored
278-line class, listed in §8.

### 3.3 Proofs

1. **Seeded-secret:** throwaway container logs fake JWT + `Authorization:
   Bearer x` + `Cookie: a=1; b=2` + `?code=x` + `dp.st.x…` + `password=…`;
   every value `[REDACTED*]` in Loki; raw values zero hits.
2. **Retention floor:** 29-day query returns data (scripted).
3. **Pino unit:** serialized log object redacts all five paths.
4. **Pino live:** fresh-traffic grep-count 0 for raw JWT/email header shapes.

## 4. Analysis service design (item `c9c15852`)

### 4.1 Dashboard — two new panels only

(a) per-container error-rate timeseries; (b) redaction-health stat
(`[REDACTED` count). Top-error table and filtered tail already exist
(panels 5 / 105-50) — do not duplicate.

### 4.2 Alerts

`SecretLeakDetected` exactly as rev 2 (sum by container, annotations,
`ALERT_TRIGGER_MAP` entry with `category: security` — a `registry/api.py`
code change; B4 is med risk). Plus `LokiStoreGrowth` (§2.2). Runbook line:
rotate first; never paste a matching line anywhere.

**Drill procedure** (completeness finding — the drill would otherwise page a
real security incident): run in a declared window; the seeded line goes to a
synthetic container label `secretleak-drill`; an Alertmanager silence scoped
to `container="secretleak-drill"` is set BEFORE the push; assert the rule
fires and the incident dedups; annotate + resolve the incident as
"verified drill"; remove the silence. Close-out is part of B8's acceptance.

### 4.3 AI log-chat

As rev 2 (deterministic query building + fuzzy container resolution against
`label_values`; ≤ 8,000-token context of stripped lines; citations-first;
buffered-then-stream with one retry then `degraded`; container-name-only
grounding; **local-only, no cloud fallback**; dedicated `LOGS_CHAT_TOKEN`;
audit row per call) with two corrections:

- **Timeout budget:** total 45 s (Porter precedent): Loki phase ≤ 30 s,
  generation+validation ≤ 15 s; `heartbeat` events every 5 s across BOTH
  phases; on budget exhaustion emit `degraded` with the context intact.
- **nginx:** B7 adds a dedicated `location /api/logs/` block with
  `proxy_read_timeout 120s` and buffering off, mirroring `/api/talkback` —
  the generic `/api/` location is capped at 30 s and would kill the stream.

### 4.4 Acceptance (build phase)

- Retention floor: 29-day query returns data (scripted, repeatable)
- Growth alert fires in a threshold drill (lowered threshold, then restored)
- Seeded multi-shape secret line fully redacted; raw values zero hits
- Pino unit test green (its own bullet — B1's acceptance, distinct from the live proof)
- Healthcheck share in fresh portage-api lines ≤ 5 % post-fix (was 58.8 %) — *if §8.2 approved*
- Dashboard v2 live (error-rate + redaction-health panels, no duplicates)
- `SecretLeakDetected` drill per §4.2: fires, dedups to ONE security-category incident, closed out
- Log-chat: real incident question answered with citations; container grounding passes; zero Anthropic calls asserted; audit row written; 45 s budget honored through nginx
- Runbook page published + KB-ingested; KB search returns it
- Web panel (B9) live in dhg-frontend; answers the B8 incident question from the browser

## 5. Build task breakdown (next /ship)

| # | Task | Repo | Risk |
|---|------|------|------|
| B0 | Growth alert (`LokiStoreGrowth` @ 20 GB) + retention-floor proof script + operator-only deletion procedure documented (NO automatic deletion — directive 16:06) | aifactory | low |
| B1 | pino `redact` (5 paths incl. CF email header) + unit test | portage | low |
| B2 | promtail redaction stages (6, corrected forms) + JSON healthcheck drop (*if §8.2 approved*); done only when B3 passes | aifactory | med |
| B3 | Seeded-secret + retention-floor + pino proofs (scripted) | both | low |
| B4 | `SecretLeakDetected` + `LokiStoreGrowth` rules + `ALERT_TRIGGER_MAP` entries (registry/api.py) + dedup check | aifactory | med |
| B5 | Dashboard v2: error-rate + redaction-health panels only | aifactory | low |
| B6 | `logs_chat_*` triad (query builder, fuzzy resolution, 8k context, buffered grounding, local-only, audit, 45 s budget) + tests | aifactory | med |
| B7 | `WRITE_PREFIXES` + `LOGS_CHAT_TOKEN` + **nginx `/api/logs/` location block (120 s)** + runbook (incl. leak response + operator-only deletion procedure) + KB ingest | aifactory | med |
| B8 | Live proof: incident question w/ citations; SecretLeak drill w/ silence + close-out; growth-alert drill; no-cloud assertion | both | med |
| B9 | Log-chat web panel in dhg-frontend (SSE client, citations block, degraded state; reuse log-stream.tsx) | aifactory | med |

Deploy order: B1 (portage rebuild) → B2 (promtail restart; positions file
survives restart — bind-mount it before any container *recreation*) → B3 →
B0/B4/B5 (ruler + grafana reload) → B6/B7 (registry rebuild + nginx reload)
→ B8 → B9 (frontend rebuild). Rollback: config in git + restarts; nothing here deletes data, so
every step is reversible.

## 6. Scope compliance (deferral-rule audit, completeness round)

- **"Docker logging-driver caps" (P5 item text):** already shipped —
  global `/etc/docker/daemon.json` `10m × 3` (evidence §1). Satisfied, not
  descoped.
- **"UI live" (P5 build acceptance):** read as the *web UI dashboard* named
  in the P5 agenda ("web UI dashboard — live stats, per-container error
  rates") — satisfied by the Grafana dashboard (B5), which is live web UI.
  A dedicated log-chat web panel is additionally BUILT as B9 (operator
  ruling §8.1 — "no deferrals").
- Doppler pattern, KB ingest, healthcheck fix: in-spirit extensions of
  `13699992`'s redaction/volume concerns, attributed here.

## 7. Explicitly out of scope

New Postgres log store (rejected option B); changing the 10m×3 caps;
off-host shipping/backups; PII scrubbing at rest (redaction targets new
lines only — see §8.3).

## 8. Operator rulings (2026-08-23 16:12 ET — "1 no deferrals 2 yes 3 leave")

1. **Log-chat web panel: BUILT, not deferred.** New task **B9**: a panel in
   the aifactory frontend (`dhg-frontend`) consuming `POST /api/logs/chat`
   SSE, reusing `frontend/src/components/agents/log-stream.tsx` as the
   scrolling-log/answer surface — question box, context/citations block
   (queries + line counts from the `context` event), streamed answer,
   `degraded` state rendered honestly. Acceptance: panel live in
   dhg-frontend; asks the B8 incident question end-to-end from the browser.
2. **Healthcheck drop at ingest: approved.** Future `/health|/ready|/metrics`
   ping lines are not stored (58.8 % of portage-api volume); §4.4's ≤ 5 %
   bullet is active.
3. **Already-stored secret lines: left in place** (LAN-only store). The
   operator-only deletion procedure (B0) exists for whenever the operator
   chooses; automation never touches them.
