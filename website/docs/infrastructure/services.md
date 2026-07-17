---
id: services
title: "Service Runbook"
sidebar_position: 2
---

# Service Runbook

Operational detail for the five services in `docker-compose.yml`. For the full-stack map (including the pieces that run outside compose), see the [Infrastructure Overview](/docs/infrastructure/overview); for the standard build commands, see [Deployment](/docs/deployment).

## The deploy model (read this first)

**Both application containers (`portage-api`, `portage-app`) are image-baked — no bind mounts.** Code changes do nothing to a running container; the deploy ritual for any code change is always:

```bash
docker compose up -d --build <service>
```

Hot-reload development is an explicit opt-in overlay for the API only:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build portage-api
```

What the overlay (`docker-compose.dev.yml`) actually changes:

- **Build**: swaps `apps/api/Dockerfile` for `apps/api/Dockerfile.dev`, whose CMD is `npm run dev -w apps/api` (`tsx watch src/index.ts`) instead of the compiled `dist` build
- **Environment**: sets `NODE_ENV=development`
- **Bind mounts**: mounts `./apps/api/src` and `./packages/shared/src` into the container so `tsx watch` picks up edits live

Everything else (ports, healthcheck, networks, `env_file`) is inherited from the base file. To return to the baked image, run the plain `docker compose up -d --build portage-api` again.

## portage-db

**What it is:** PostgreSQL 15 (`postgres:15-alpine`), the only datastore. Data lives in the named volume `portage-pgdata`.

**How it connects:** Published on `127.0.0.1:5436:5432` — loopback-only, invisible to the LAN. Containers on `portage-network` connect via `portage-db:5432` (that is what `DATABASE_URL` in the API's compose environment uses). Healthcheck: `pg_isready -U portage` every 10s.

**How to operate:**

```bash
# Logs
docker compose logs -f portage-db

# Push schema changes (Drizzle schema-push workflow, no migration files)
npm run db:push
```

:::warning The db:push host gotcha
Because the port binding is loopback-only, host-side `db:push` and `psql` must target **`127.0.0.1:5436`** — a connection string pointing at `10.0.0.251:5436` is unreachable from the host itself. After a schema push, rebuild the API container so the running code matches the schema.
:::

## portage-api

**What it is:** The Express 5 backend (TypeScript, pino logging), serving HTTPS on `:8016` with a self-signed cert (SAN `10.0.0.251`) mounted read-only from `certs/`. Secrets come from `env_file: .env` (Doppler-synced — see [Secrets & Storage](/docs/infrastructure/secrets-and-storage)).

**How it is deployed:** Image-baked from `apps/api/Dockerfile` (compiled `dist`, `NODE_ENV=production`). Deploy = rebuild:

```bash
docker compose up -d --build portage-api
```

Hot-reload dev is the opt-in overlay described above.

**How it connects:** `depends_on: portage-db (condition: service_healthy)` — the API will not start until Postgres passes `pg_isready`. Its own healthcheck is a Node HTTPS probe of `https://localhost:8016/health` (self-signed cert accepted via `rejectUnauthorized: false`), 15s `start_period`. It sits on both `portage-network` (db, rembg) and the external `dhg-network` (DHG Registry on `:8011`). Prometheus scrape labels on the service advertise `/metrics` on port 8016 — see [Monitoring](/docs/monitoring).

**How to operate:**

```bash
docker compose logs -f portage-api
docker compose ps            # health status
```

:::note Shared package rebuild
`packages/shared` compiles to `dist/` via `tsc`. After changing anything in the shared package, rebuild it before building or running the API or web app outside Docker:

```bash
npm run build -w packages/shared
```

(Docker builds run this step inside the image, so `docker compose up -d --build` covers it automatically.)
:::

## portage-app

**What it is:** The Next.js frontend in standalone mode, host `:3002` → container `:3000`. It serves plain HTTP behind the Cloudflare Tunnel; API traffic goes through the same-origin `/backend/:path*` rewrite in `apps/web/next.config.ts` to `API_INTERNAL_URL` (`https://10.0.0.251:8016`), with the API's self-signed cert trusted via `NODE_EXTRA_CA_CERTS=/app/certs/cert.pem`.

**How it is deployed:** Image-baked from `apps/web/Dockerfile` (with a `GIT_SHA` build arg). Deploy = rebuild:

```bash
docker compose up -d --build portage-app
```

There is no dev overlay for the web container — LAN development runs `npm run dev:web` on the host instead.

**How it connects:** `depends_on: portage-api (condition: service_healthy)`, so the stack comes up in order db → api → app. Healthcheck: Node HTTP probe of `http://localhost:3000`, 20s `start_period`. On `portage-network` only.

**How to operate:**

```bash
docker compose logs -f portage-app
```

Remember the shared-package rebuild note above if you changed `packages/shared` and are running the web app outside Docker.

## portage-rembg

**What it is:** The upstream `danielgatis/rembg:latest` background-removal server, run as `s --port 7000 --no-ui`, published on `:7000`. The API calls it via `REMBG_URL=http://portage-rembg:7000` over `portage-network` (`POST /images/remove-bg` is the API-side entry point).

**How it is deployed:** Stock upstream image — no build step. `docker compose up -d` (or `docker compose pull portage-rembg && docker compose up -d portage-rembg` to take a new upstream release).

**How it connects:** No `depends_on` in either direction — the API degrades gracefully if it is down rather than refusing to start. Healthcheck probes `http://localhost:7000/api` with a **30s `start_period`**, the longest in the stack, because the container needs time to load its model before it answers.

**How to operate:**

```bash
docker compose logs -f portage-rembg
```

## portage-graph

**What it is:** `nginx:alpine` on host `:8018` serving three read-only bind mounts: `./graphify-out` (the generated code knowledge graph — `graph.html` dashboard, wiki, `graph.json`), `./infra/portal` (the stack portal at `/portal/`), and `./infra/graphify-nginx.conf` (the nginx server config).

**How it is deployed:** No build step and, for content, usually no docker command at all — regenerating the graph (`/graphify /path --update`) writes into `graphify-out/`, and per the compose file's own comment **the bind mount picks up new builds with no restart**. That holds because graphify edits files in place inside the mounted directory; the repo's audit log (`docs/audits/2026-07-graphify-interface-log.md`) confirms live-over-HTTP verification with no restart after in-place changes.

:::caution Bind-mount inode caveat
The no-restart property depends on the directory being updated *in place*. If a process **deletes and recreates** a bind-mounted directory (a build tool that wipes its output dir, a `git checkout` that replaces it), the container keeps serving the deleted directory's ghost inode — empty or stale content. This bit the docs stack on 2026-07-10 (`docs/session-reports/2026-07-10-scan-outage-and-beta-bug-batch.md`): nginx served a deleted Docusaurus build directory until the container was restarted. If `:8018` ever serves stale or empty content after a regeneration, the fix is:

```bash
docker compose restart portage-graph
```
:::

**How it connects:** `portage-network` only. It has **no healthcheck** — acceptable because it is a static file server with no dependents: nothing in the stack `depends_on` it, it holds no state, and a failure is immediately visible (the `:8018` dashboard stops loading) without affecting the app, API, or database.

**How to operate:**

```bash
docker compose logs -f portage-graph
docker compose restart portage-graph   # only needed after an inode swap (see caveat)
```
