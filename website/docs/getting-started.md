---
id: getting-started
title: Getting Started
sidebar_position: 1
---

# Getting Started

*Last verified: 2026-07-17*

Portage is an AI-powered personal effects inventory and multi-marketplace seller platform. Capture photos of your items, let AI identify and value them, then list across eBay and Reverb from a single mobile-first interface.

What sets Portage apart:

- **AI-first pipeline** — scan an item, get comp-based pricing, publish with one tap
- **Trade-First eBay publishing** — lists via the Trading API with inline shipping terms, no Business Policies required
- **Porter assistant** — a conversational AI that works over your real inventory, not canned demos

## Prerequisites

- **Node.js 20+** and npm
- **Docker** and Docker Compose (for full-stack development)
- **PostgreSQL 15** (provided via Docker or standalone)
- **Doppler CLI** (for secrets management)

## Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/sdnydude/portage.git
cd portage

# Install dependencies
npm install

# Start all services
docker compose up -d

# Verify services are running
docker compose ps
```

All dev URLs use the server IP `10.0.0.251`, not `localhost` (the database is the exception — it binds loopback-only):

| Service | URL | Purpose |
|---------|-----|---------|
| portage-app | `http://10.0.0.251:3002` | Next.js frontend (standalone, HTTP) |
| portage-api | `https://10.0.0.251:8016` | Express API (HTTPS, self-signed cert) |
| portage-db | `127.0.0.1:5436` | PostgreSQL (loopback-only) |
| portage-rembg | `http://10.0.0.251:7000` | [Background removal service](/docs/api/images) |

Both application containers are image-baked — after code changes, redeploy with `docker compose up -d --build <service>`. An opt-in hot-reload overlay exists for API development: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build portage-api`.

## Quick Start (Manual)

```bash
# Install dependencies
npm install

# Build the shared package
npm run build -w packages/shared

# Push database schema
npm run db:push

# Start API and web in separate terminals
npm run dev:api   # Express on https://10.0.0.251:8016
npm run dev:web   # Next.js on https://10.0.0.251:3002 (HTTPS in dev via --experimental-https)
```

Unlike the Docker frontend (plain HTTP behind Cloudflare), `npm run dev:web` serves HTTPS with local certs so camera access works over the LAN.

## Environment Variables

See the [Environment Variables](/docs/environment-variables) page for the full list.

**With Doppler (DHG):** secrets are managed through [Doppler](https://doppler.com) and synced to `.env` automatically — the `SessionStart` hook regenerates `.env` from Doppler at the start of each Claude Code session, so edit secrets in Doppler, never in `.env` directly. You can also run any command with secrets injected: `doppler run -- <command>`.

**Without Doppler:** copy `.env.example` to `.env` and fill in the required values.

## Project Structure

```
portage/
  apps/
    api/          Express 5 backend
    web/          Next.js 16 frontend
  packages/
    shared/       TypeScript types and constants
  docker-compose.yml
  docker-compose.dev.yml    # opt-in hot-reload overlay
```

Portage uses **npm workspaces** to manage the monorepo. The three packages (`apps/api`, `apps/web`, `packages/shared`) share dependencies and types through the workspace root.

## Quality Gates

```bash
npm run typecheck     # TypeScript across all workspaces
npm run lint          # ESLint (web)
npm run test:api      # Vitest API test suite
```

For the live backlog and in-flight work, see [docs/TODO.md](https://github.com/sdnydude/portage/blob/main/docs/TODO.md) in the repository.

## Authentication

Cloudflare Access is the identity provider — there are no passwords. Signing in requires your email to be on the admin-managed Cloudflare Access allowlist; the API verifies the CF Access JWT and auto-provisions your user account on first login. For LAN development without a Cloudflare edge, set `CF_ACCESS_DEV_EMAIL` (honored only when `NODE_ENV=development`).

## Next Steps

- [Architecture Overview](/docs/architecture/overview) — understand how the pieces fit together
- [Features](/docs/features) — every shipped feature and what makes it unique
- [API Reference](/docs/api/overview) — explore the REST API
- [App Structure](/docs/frontend/app-structure) — how the Next.js frontend is organized
- [Design System](/docs/frontend/design-system) — learn about the UI framework
- [Deployment](/docs/deployment) — Docker services, tunnel, and deploy ritual
