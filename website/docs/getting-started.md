---
id: getting-started
title: Getting Started
sidebar_position: 1
---

# Getting Started

Portage is an AI-powered personal effects inventory and multi-marketplace seller platform. Capture photos of your items, let AI identify and value them, then list across eBay and Reverb from a single mobile-first interface.

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

| Service | URL | Purpose |
|---------|-----|---------|
| portage-app | `http://localhost:3002` | Next.js frontend (standalone, HTTP) |
| portage-api | `https://localhost:8016` | Express API |
| portage-db | `localhost:5436` | PostgreSQL (loopback-only) |
| portage-rembg | `http://localhost:7000` | Background removal service |

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
npm run dev:api   # Express on :8016
npm run dev:web   # Next.js on :3002
```

## Environment Variables

Secrets are managed through [Doppler](https://doppler.com). See the [Environment Variables](/docs/environment-variables) page for the full list.

For local development without Doppler, copy `.env.example` to `.env` and fill in the required values.

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
npm run test:api      # Vitest API test suite (~664 tests)
```

## Authentication

Cloudflare Access is the identity provider — there are no passwords. Signing in requires your email to be on the admin-managed Cloudflare Access allowlist; the API verifies the CF Access JWT and auto-provisions your user account on first login. For LAN development without a Cloudflare edge, set `CF_ACCESS_DEV_EMAIL` (honored only when `NODE_ENV=development`).

## Next Steps

- [Architecture Overview](/docs/architecture/overview) — understand how the pieces fit together
- [API Reference](/docs/api/overview) — explore the REST API
- [Design System](/docs/frontend/design-system) — learn about the UI framework
