---
id: deployment
title: Deployment
sidebar_position: 1
---

# Deployment

Portage runs on a dedicated Ubuntu server with Docker Compose. Production traffic routes through Cloudflare Tunnel.

## Infrastructure

| Component | Details |
|-----------|---------|
| Server | g700data1 (10.0.0.251), Ubuntu 24.04, 64GB RAM |
| Containers | Docker Compose (3 services) |
| CDN/Proxy | Cloudflare Tunnel |
| Image Storage | Cloudflare R2 |
| Secrets | Doppler |
| Domain | `portage.digitalharmonyai.com` |

## Docker Services

```yaml
services:
  portage-db:
    image: postgres:15
    ports: ["5436:5432"]

  portage-api:
    build: .
    target: api
    ports: ["8016:8016"]

  portage-app:
    build: .
    target: web
    ports: ["3002:3002"]
```

### Common Commands

```bash
# Start all services
docker compose up -d

# Rebuild after code changes
docker compose up -d --build portage-api portage-app

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
Browser → Cloudflare Edge → Tunnel → https://localhost:3002 (Next.js)
                                   → https://localhost:8016 (API)
```

The tunnel is configured with `noTLSVerify` since the local services use self-signed certificates.

## HTTPS

Both the API and web services run HTTPS in production:

- **Next.js**: Uses `--experimental-https` with certificates at `certs/key.pem` and `certs/cert.pem`
- **Express**: HTTPS server with the same certificate files
- **Camera access**: `getUserMedia` requires HTTPS — this is not optional

## Database

PostgreSQL runs in Docker on port 5436. Schema changes are applied via Drizzle's push workflow:

```bash
npm run db:push
```

There are no migration files — the Drizzle schema file (`apps/api/src/db/schema.ts`) is the source of truth.

## Secrets Management

All secrets are managed through [Doppler](https://doppler.com). The `SessionStart` hook automatically syncs secrets to `.env` at the beginning of each development session:

```bash
doppler secrets download --no-file --format env > .env
```

Never commit `.env` files or hardcode secrets in source code.

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

Docker health checks are configured for all three services:

| Service | Health Check |
|---------|-------------|
| portage-db | `pg_isready` |
| portage-api | `curl -sk https://localhost:8016/health` |
| portage-app | `curl -sk https://localhost:3002` |
