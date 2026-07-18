---
id: overview
title: "Infrastructure Overview"
sidebar_position: 1
---

import ThemedImage from '@theme/ThemedImage';

# Infrastructure Overview

Everything Portage runs on lives on one server — **g700data1** (`10.0.0.251`, Ubuntu 24.04, 64GB RAM). Five containers are defined in `docker-compose.yml`; a handful of adjacent pieces (docs site, DHG Registry, Cloudflare tunnel, GitHub Actions runner) run alongside the stack and connect to it. This page is the full map; each piece links to its operational detail.

<ThemedImage alt="Portage full-stack infrastructure topology" sources={{light: '/portage/img/infra-topology.svg', dark: '/portage/img/infra-topology-dark.svg'}} />

## Compose Services

The five services below are defined in `docker-compose.yml` at the repo root. Per-service operational detail (rebuild rituals, log commands, gotchas) lives in the [Service Runbook](/docs/infrastructure/services).

### portage-db

PostgreSQL 15 (`postgres:15-alpine`). The port binding is **loopback-only**: `127.0.0.1:5436:5432`. The database is deliberately unreachable from the LAN — only processes on the host itself (and containers on `portage-network`, which use the container DNS name `portage-db:5432`) can connect. The practical consequence: host-side `npm run db:push` or `psql` must target `127.0.0.1:5436`, never `10.0.0.251:5436`. Data persists in the named volume `portage-pgdata`, and the healthcheck runs `pg_isready -U portage`.

### portage-api

The Express 5 backend, built from `apps/api/Dockerfile` and published on `:8016`. It serves **HTTPS with a self-signed certificate** (SAN `10.0.0.251`) — the `certs/` directory is mounted read-only into the container, and the container's own healthcheck probes `https://localhost:8016/health` with `rejectUnauthorized: false`. Runtime configuration comes from `env_file: .env` (synced from Doppler — see [Secrets & Storage](/docs/infrastructure/secrets-and-storage)). The service carries Prometheus scrape labels (`prometheus.io/scrape: "true"`, port `8016`, path `/metrics`) and is the only service attached to **both** `portage-network` and the external `dhg-network` (see [Networks](#networks) below).

### portage-app

The Next.js frontend in standalone mode, built from `apps/web/Dockerfile`. Host port **3002** maps to container port **3000**. The browser never talks to the API directly — `apps/web/next.config.ts` rewrites `/backend/:path*` to `API_INTERNAL_URL`, which compose sets to `https://10.0.0.251:8016`. That URL goes via the host-published port on purpose: the API's self-signed cert has SAN `10.0.0.251`, and it verifies inside the app container because `NODE_EXTRA_CA_CERTS=/app/certs/cert.pem` points at the same mounted cert. The same-origin rewrite is what lets the Cloudflare Access cookie and `Cf-Access-Jwt-Assertion` header ride along on every API call with no CORS.

### portage-rembg

Background-removal service (`danielgatis/rembg:latest`), run as `s --port 7000 --no-ui` and published on `:7000`. The API reaches it over the compose network via `REMBG_URL=http://portage-rembg:7000`. Its healthcheck probes `http://localhost:7000/api` with a generous 30s `start_period` (model load takes time).

### portage-graph

Code knowledge graph dashboard: plain `nginx:alpine` on host port **8018** (container port 80) with three read-only bind mounts — `./graphify-out` (the generated graph artifacts, served as the site root), `./infra/portal` (the stack portal at `/portal/`), and `./infra/graphify-nginx.conf` (the server config). It has **no healthcheck** — acceptable for a static file server with no dependents (see the [Service Runbook](/docs/infrastructure/services#portage-graph) for the rationale).

## Adjacent Pieces (outside docker-compose.yml)

### dhg-docs (:8017)

The Docusaurus documentation site you are reading. It is an nginx container on port **8017**, but it runs **outside** this compose file — it is created/restarted by the docs CI workflow (`.github/workflows/deploy-docs.yml`) and serves the shared AI Factory `docs-site/build` directory, of which Portage docs are one project. Full pipeline: [CI/CD & Docs Pipeline](/docs/infrastructure/ci-cd).

### DHG Registry (:8011)

The DHG Registry (knowledge base, session capture, doc search) belongs to the separate AI Factory stack. Portage reaches it over the **external `dhg-network` bridge** — `docker-compose.yml` declares `dhg-network` as `external: true` with the real name `dhgaifactory35_dhg-network`, and attaches only `portage-api` to it. See [Registry Integration](/docs/development/registry-integration).

### Cloudflare Tunnel + Access

Production traffic enters through a Cloudflare Tunnel (no public ports), with Cloudflare Access as the identity provider in front of the app. Tunnel config lives in `infra/cloudflared/`. Full detail: [Cloudflare Tunnel & Access](/docs/infrastructure/cloudflare).

### Doppler Secrets + Cloudflare R2 Storage

Secrets are managed in Doppler and synced to `.env` (never committed); item photos live in Cloudflare R2. See [Secrets & Storage](/docs/infrastructure/secrets-and-storage).

### GitHub Actions Self-Hosted Runner

A self-hosted runner on g700data1 executes the docs deploy workflow (build Docusaurus → restart `dhg-docs` → ingest into the Registry). See [CI/CD & Docs Pipeline](/docs/infrastructure/ci-cd).

### Monitoring

`portage-api` exposes `/metrics` and carries Prometheus scrape labels in compose; Grafana dashboards and the admin observability page sit on top. See [Monitoring](/docs/monitoring).

## Networks

Two Docker networks exist, and the split is intentional. **`portage-network`** is a plain bridge network private to this compose file — all five services live on it, and it is how they resolve each other by container name (`portage-db`, `portage-rembg`). **`dhg-network`** is an *external* network (`dhgaifactory35_dhg-network`) owned by the AI Factory stack; `portage-api` joins it solely so it can reach the DHG Registry on `:8011` for knowledge-base capture and search. Keeping the two separate means the Portage stack stays self-contained — nothing in the AI Factory stack can reach the database or the frontend, and only the API crosses the boundary.

## Summary

| Piece | Port | Deploy mechanism | Where documented |
|-------|------|------------------|------------------|
| portage-db | 127.0.0.1:5436 → 5432 | `docker compose up -d` (stock image + `portage-pgdata` volume) | [Service Runbook](/docs/infrastructure/services#portage-db) |
| portage-api | 8016 (HTTPS) | `docker compose up -d --build portage-api` (image-baked) | [Service Runbook](/docs/infrastructure/services#portage-api) |
| portage-app | 3002 → 3000 | `docker compose up -d --build portage-app` (image-baked) | [Service Runbook](/docs/infrastructure/services#portage-app) |
| portage-rembg | 7000 | `docker compose up -d` (upstream image) | [Service Runbook](/docs/infrastructure/services#portage-rembg) |
| portage-graph | 8018 → 80 | `docker compose up -d`; content updates via graphify regeneration, no restart | [Service Runbook](/docs/infrastructure/services#portage-graph) |
| dhg-docs | 8017 → 80 | GitHub Actions workflow restart/recreate | [CI/CD & Docs Pipeline](/docs/infrastructure/ci-cd) |
| DHG Registry | 8011 | Separate AI Factory stack | [Registry Integration](/docs/development/registry-integration) |
| Cloudflare Tunnel + Access | — (outbound tunnel) | `infra/cloudflared/` config | [Cloudflare Tunnel & Access](/docs/infrastructure/cloudflare) |
| Doppler / R2 | — | SessionStart sync / R2 bucket | [Secrets & Storage](/docs/infrastructure/secrets-and-storage) |
| GitHub Actions runner | — | systemd service on g700data1 | [CI/CD & Docs Pipeline](/docs/infrastructure/ci-cd) |

For the standard deploy rituals and build commands shared across services, see [Deployment](/docs/deployment).
