---
id: registry-integration
title: Registry Integration
sidebar_position: 3
---

# Registry Integration

This page documents how code in this repository talks to the DHG Registry — the session memory and knowledge store at `http://10.0.0.251:8011`.

## Decoupling Principle

Almost nothing in the Portage **product** talks to the registry. The one exception is the in-app beta-reporting endpoint (`POST /beta/report` in `apps/api/src/routes/beta.ts`, added with the CF Access beta migration): the API proxies beta-tester/admin reports to the registry's `/api/beta-reports` (base URL from `REGISTRY_URL`, default `http://10.0.0.251:8011`), returning a 502 if the registry is unreachable. Beyond that, the app's only `10.0.0.251` runtime dependencies are PostgreSQL (`:5436`) and display-only links to Grafana (`:3001`) and Prometheus (`:9090`) on the admin observability page.

The DHG Registry is otherwise a **dev/ops sidecar, not a runtime dependency.** If it is down, Portage runs normally except beta reporting. Claude Code session memory-capture and briefing degrade, and they fail silently by design.

## Base Mechanism

All registry traffic is plain HTTP/JSON to `http://10.0.0.251:8011`. No SDK. No auth header on the LAN path. The base URL is overridable via the `REGISTRY_URL` environment variable.

## Channel 1 — Autopost (Session Writes)

The primary write channel. Rules in `.claude/rules/*.md` instruct Claude Code to call shell scripts named `~/.claude/scripts/post-<type>.sh`. Those home-directory scripts are thin shims that exec a single shared Python dispatcher:

```
~/.claude/scripts/post-insight.sh  →  /home/swebber64/DHG/dhg-memreg/scripts/memreg_capture.py
```

`memreg_capture.py` maps 9 subcommands 1:1 to registry endpoints:

| Command | Endpoint |
|---|---|
| `post-agent-session` | `POST /api/agent-sessions` |
| `post-insight` | `POST /api/insights` |
| `post-decision-logs` | `POST /api/decision-logs` |
| `post-bug-fixes` | `POST /api/bug-fixes` |
| `post-correction` | `POST /api/corrections` |
| `post-deferred-items` | `POST /api/deferred-items` |
| `post-session-reports` | `POST /api/session-reports` |
| `post-ship-session` | `POST /api/ship-sessions` |
| `post-test-coverage` | `POST /api/test-coverage` |

Implementation details:

- Transport: `httpx.post(url, content=payload, headers={"Content-Type": "application/json"})`
- Timeout: 2 s connect, 5 s read
- Always exits 0 — fire-and-forget, never blocks a session
- On 2xx: prints `"{label} captured: {id}"`
- On error: prints to stderr, still exits 0

## Channel 2 — Hooks (Automatic Read + Write)

Claude Code hooks in `.claude/hooks/` use plain `curl` for registry I/O:

**`session-briefing.sh` (SessionStart hook)** — assembles the cold-start briefing by reading:

- `GET /api/agent-sessions?project=portage&limit=3` — recent session summaries
- `GET /api/ship-sessions?project_name=portage&limit=5` — recent ship sessions
- `GET /api/corrections?project_name=portage&limit=5` — recent correction lessons
- `GET /api/bug-fixes?project_name=portage&limit=3` — recent bug-fix root causes

**`session-capture.sh` (Stop hook)** — posts the session summary on exit:

- `POST /api/agent-sessions` — session metadata, branch, commits, and the contents of `.remember/now.md` as the summary

Both hooks use `--connect-timeout 3 --max-time 5` and route all errors to `/dev/null || true` — they never block session start or stop.

## Channel 3 — KB Search (On-Demand Read)

The `registry-search.md` rule instructs Claude Code to issue a hybrid search query before answering questions about prior work:

```bash
curl -s -X POST http://10.0.0.251:8011/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{"query":"<the question>","project_name":"portage","limit":10}'
```

The `/api/kb/search` endpoint runs a unified RRF (Reciprocal Rank Fusion) search across all registry corpora:

| Source | Contains |
|---|---|
| `docs` | Docusaurus documentation chunks |
| `insights` | AI-captured insight blocks from Claude sessions |
| `decisions` | Architectural decision logs with alternatives and rationale |
| `ship_sessions` | /ship workflow records: plans, decisions, deferred items |
| `corrections` | User corrections to Claude behavior |
| `bug_fixes` | Root cause analyses: symptom, cause, fix, severity |
| `deferred_items` | Work discovered but intentionally deferred |
| `agent_sessions` | Claude Code session summaries and metadata |
| `dev_changelog` | Development changelog entries by epic/category |

Filter to specific corpora by passing a `"sources"` array in the request body.

Note: `session_reports` (narrative session reports — markdown file in `docs/session-reports/` + registry row, captured via `post-session-reports` above) is stored in the registry but not yet exposed as a `/api/kb/search` source (verified 2026-07-17 — the endpoint rejects it as an invalid source value).

## Channel 4 — Docs CI Ingestion (Write, Not HTTP)

`.github/workflows/deploy-docs.yml` does **not** POST over HTTP for ingestion. The self-hosted runner on g700data1 has direct filesystem access to the registry repo, so it runs the registry's own ingestion script in place:

```bash
cd /home/swebber64/DHG/aifactory3.5/dhgaifactory3.5/registry
python3 doc_ingest.py \
  --project portage \
  --docs-dir /home/swebber64/DHG/aifactory3.5/dhgaifactory3.5/docs-site/projects/portage
```

The script writes directly to the registry database (no HTTP round-trip). The workflow then verifies the result via `GET /api/doc-pages?project_name=portage`.

Before ingestion, the CI step copies `website/docs/` from the portage repo into the shared docs-site at `docs-site/projects/portage/`, builds the Docusaurus site, and restarts the nginx container — all in sequence before the ingestion step runs.

## Auth Regimes

Two different auth regimes apply depending on the network path:

| Path | Auth |
|---|---|
| LAN (`10.0.0.251:8011`) | No auth — used by all channels above |
| Public (`registry.digitalharmonyai.com`) | Cloudflare Access service token required |

External integrations (webhooks, remote scripts) hitting the public hostname must supply `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers. On-host tooling — all four channels described on this page — uses the LAN path and requires no credentials.
