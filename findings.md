# Findings: Secrets Management Migration

## Current State Inventory (2026-04-26)

### Infrastructure
- **Server:** g700data1 (10.0.0.251), Ubuntu 24.04, 64GB RAM
- **Containers running:** ~50 across 12+ project stacks
- **Cloudflare tunnel:** Active (30437aa6), serving app/vs/otel subdomains of digitalharmonyai.com
- **Infisical:** secrets.digitalharmonyai.com was configured but NOT in tunnel ingress — dead route

### Broken Infisical (TWO installs)

| Install | Path | Port | Status |
|---------|------|------|--------|
| Production | `~/DHG/aifactory3.5/infisical/` | 8089 | Running 3 weeks, Google OAuth, SITE_URL=secrets.digitalharmonyai.com |
| Abandoned | `~/infisical-stack/` | 8082 | Running 3 weeks, hardcoded creds in compose, different Postgres |

- CLI v0.31.1 (current: v0.159.22) — 130+ versions behind
- CLI auth broken: keyring unlock failure
- Only `aifactory3.5` has `.infisical.json` — no other project connected
- Net result: nobody uses it, secrets live in .env files + Apple Notes

### Secret Counts

| Project | .env lines | Key count |
|---------|-----------|-----------|
| aifactory3.5 | 145 | ~100 |
| chatgptcli | 80 | ~42 |
| portage | 70 | ~41 |
| Digital-Harmony-Studio-v1 | 37 | ~22 |
| DHS/dhg-transcribe | 24 | ~8 |
| DHS/dhg-cognitive | 21 | ~8 |
| uibakery | 12 | ~12 |
| c2l-vault | 7 | ~7 |
| weimap | 6 | ~3 |
| dhg_media-center | 5 | ~2 |

**Total: 190 unique secret keys across 13 .env files**

### Shared Secrets (same key, multiple projects)
- `OPENAI_API_KEY` — 10 projects (most shared)
- `ANTHROPIC_API_KEY` — 5 projects
- `DATABASE_URL` — 4 projects (different values per project)
- `REDIS_URL` — 2 projects

### Cloudflare Assets
- **Account ID:** 6a8551be708b62019c88fcbbf7789714
- **Zone ID:** 2f3eeeb2651fec9b85f15290f966a885
- **API Token:** exists in aifactory3.5 .env
- **CF Access:** client ID + secret configured
- **Tunnel:** active systemd service, 3 ingress rules (app, vs, otel)
- **No Wrangler configs** found — no Workers deployed yet

### Active Projects (running containers needing secrets)
1. portage (API + web + DB)
2. aifactory3.5 (frontend, registry, vs-engine, session-logger, logo-maker, pdf-renderer, remediator, ollama)
3. medkb (API + ingestor + DB + cache)
4. dhg-transcribe (API, worker, preprocessor, NLP pipeline, QC, minio, DB, qdrant, redis)
5. dhg-audio-agent (agent + postgres)
6. dhg-cognitive
7. plane (project management — 8 containers)
8. infisical (to be removed)
9. monitoring stack (prometheus, grafana, loki, tempo, promtail, alertmanager, cadvisor, node-exporter, postgres-exporter)
10. pgadmin
11. uibakery

### Archived/Inactive (not running)
- archive2/, Archive/, Zips/, factory352/, dhg-frontend-glass, snipe-it, weimap, chatgptcli, architect-agent, dhg_hardware, LongCat-Video, prediction-market-analysis
