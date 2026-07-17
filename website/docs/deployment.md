---
id: deployment
title: Deployment
sidebar_position: 5
---

# Deployment

*Last verified: 2026-07-17*

Portage runs on a dedicated Ubuntu server with Docker Compose. Production traffic routes through Cloudflare Tunnel. Per-service operational detail lives in the new [Infrastructure](/docs/infrastructure/overview) section.

## Infrastructure

| Component | Details |
|-----------|---------|
| Server | g700data1 (10.0.0.251), Ubuntu 24.04, 64GB RAM |
| Containers | Docker Compose (5 services: db, api, app, graph, rembg) |
| CDN/Proxy | Cloudflare Tunnel |
| Image Storage | Cloudflare R2 |
| Secrets | Doppler |
| Domain | `portage.digitalharmonyai.com` |

## Docker Services

| Service | Port | Image |
|---------|------|-------|
| `portage-db` | 5436 (loopback-only) | postgres:15-alpine |
| `portage-api` | 8016 (HTTPS) | Built from `apps/api/Dockerfile` (compiled `dist`, `NODE_ENV=production`) |
| `portage-app` | 3002 (host) → 3000 (container) | Built from `apps/web/Dockerfile` (Next.js standalone) |
| `portage-graph` | 8018 (host) → 80 (container) | nginx:alpine serving the `graphify-out/` code knowledge graph (read-only bind mount; new builds appear without a restart) |
| `portage-rembg` | 7000 | danielgatis/rembg (background removal) |

The docs site (`dhg-docs`, nginx on port 8017) runs separately from this compose stack — it is built and deployed by the CI workflow `.github/workflows/deploy-docs.yml` on pushes to `website/**`.

### Absolute /docs/ link convention

Pages under `website/docs/` deliberately use **absolute** `/docs/...` links and `/img/...` asset paths. The deploy workflow rewrites them at build time when copying into the shared docs-site:

```bash
find "$DOCS_SITE/projects/portage" -name "*.md" -exec sed -i 's|](/docs/|](/portage/|g' {} \;
find "$DOCS_SITE/projects/portage" -name "*.md" -exec sed -i 's|](/img/|](/portage/img/|g' {} \;
```

So `/docs/...` becomes `/portage/...` and `/img/...` becomes `/portage/img/...` on the deployed site. These links only resolve after deployment — they will 404 in a bare local Docusaurus run of this repo. That is expected; authors must keep writing the absolute `/docs/` and `/img/` forms so the rewrite catches them.

**Both application containers are image-baked** — code changes do not hot-reload. The default deploy ritual for any code change is:

```bash
docker compose up -d --build <service>
```

For hot-reload development, an explicit opt-in overlay (`docker-compose.dev.yml`) bind-mounts the API source into a tsx-watch container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build portage-api
```

### Common Commands

```bash
# Start all services
docker compose up -d

# Rebuild after code changes (the default deploy ritual)
docker compose up -d --build portage-api
docker compose up -d --build portage-app

# View logs
docker compose logs -f portage-api
docker compose logs -f portage-app

# Check health
docker compose ps

# Restart a single service
docker compose restart portage-api
```

## Cloudflare Tunnel

Production traffic reaches the server through a Cloudflare Tunnel, avoiding the need to expose ports publicly:

```
Browser → Cloudflare Edge → Tunnel → http://localhost:3002 (Next.js)
                                   → https://localhost:8016 (API)
```

Cloudflare Access sits in front as the identity provider — see [Authentication](/docs/architecture/overview#authentication). The tunnel is configured with `noTLSVerify` for the API since it uses a self-signed certificate.

## HTTPS

- **Express API**: HTTPS in the production container using certificates at `certs/key.pem` and `certs/cert.pem` (exits if certs are missing in production)
- **Next.js**: The production container serves plain HTTP (standalone mode) behind the Cloudflare Tunnel; `--experimental-https` with the same certs is used in `npm run dev:web` only
- **Camera access**: `getUserMedia` requires a secure context — in production Cloudflare terminates TLS; in LAN dev the Next.js HTTPS dev mode provides it

## Database

PostgreSQL runs in Docker on port 5436. Schema changes are applied via Drizzle's push workflow:

```bash
npm run db:push
```

There are no migration files — the Drizzle schema file (`apps/api/src/db/schema.ts`) is the source of truth.

## Secrets Management

All secrets are managed through [Doppler](https://doppler.com) — the `SessionStart` hook syncs them to `.env` automatically each session. Never commit `.env` files or hardcode secrets. Full guide: [Doppler — Secrets Management](http://10.0.0.251:8017/infrastructure/doppler/) on the DHG docs site.

## Build Process

```bash
# Full rebuild
docker compose up -d --build

# API only
docker compose up -d --build portage-api

# Web only
docker compose up -d --build portage-app

# Shared package (must rebuild before web/api if types change)
npm run build -w packages/shared
```

## Health Checks

Docker health checks are configured for four of the five services (`portage-graph` is a static nginx file server with no health check). See [Monitoring → Health Endpoints](/docs/monitoring#health-endpoints) for the endpoints these probes hit.

| Service | Health Check |
|---------|-------------|
| portage-db | `pg_isready` |
| portage-api | Node HTTPS probe of `https://localhost:8016/health` |
| portage-app | Node HTTP probe of `http://localhost:3000` |
| portage-rembg | Python urllib probe of `http://localhost:7000/api` |
