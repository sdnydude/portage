# Portage — Onboarding Guide

AI-powered personal effects inventory and multi-marketplace seller app. Scan items with AI, list across eBay and Reverb, manage orders and messaging — all from a mobile-first PWA.

## Quick Start

```bash
# Clone and install
git clone https://github.com/sdnydude/portage.git
cd portage
npm install

# Start the stack (PostgreSQL + API + Next.js)
docker compose up -d

# Or run manually
npm run dev:api    # Express on :8016
npm run dev:web    # Next.js on :3002

# Install dev tools for /ship_v3 workflow
./scripts/setup-dev-tools.sh
```

For environment setup detail (env vars, Doppler, dev URLs), see the deployed getting-started guide: `website/docs/getting-started.md` — served at http://10.0.0.251:8017/portage/getting-started/.

## Architecture

npm workspaces monorepo with three packages:

| Package | Path | Tech |
|---------|------|------|
| API | `apps/api` | Express 5, TypeScript, Drizzle ORM, pino |
| Web | `apps/web` | Next.js 16, React 19, Tailwind v4, mobile-first PWA |
| Shared | `packages/shared` | TypeScript types, constants, marketplace interfaces |

### Services

| Service | Port | Purpose |
|---------|------|---------|
| portage-db | 5436 | PostgreSQL 15 |
| portage-api | 8016 | Express REST API |
| portage-app | 3002 | Next.js frontend |

### Database

Drizzle ORM with schema-push workflow (no migration files). 18 tables. Push schema changes with `npm run db:push`.

## Quality Gates

Run these before any PR:

```bash
npm run typecheck   # All workspaces
npm run lint        # ESLint (web)
npm run test:api    # Vitest (current counts: see docs/TODO.md)
```

## Key Conventions

- **Mobile-first PWA.** Every UI component assumes a phone-sized viewport first.
- **Design system:** Forest Green (#2D5A27), Instrument Sans (display), Plus Jakarta Sans (body), JetBrains Mono (code).
- **API pattern:** Every route handler wraps in `try { ... } catch (err) { next(err) }`. Errors thrown as `AppError(status, code, message)`.
- **Auth:** Cloudflare Access is the identity provider — no passwords. `GET /auth/session` verifies the `Cf-Access-Jwt-Assertion` header against the team JWKS, auto-provisions the user row on first login, and mints a short-lived (15m) internal JWT the API consumes. `requireAuth` middleware on all protected routes. Roles: `user` | `admin`.
- **Hook contract:** All React data hooks return `{ isLoading, error, ...data }`.
- **No migration files.** Drizzle schema-push only.
- **Secrets via Doppler.** Never hardcode API keys. `.env` is auto-synced.

## Shipping Workflow

Use `/ship_v3` for feature development. It's a 7-phase workflow:

1. **Brainstorm** — problem definition, approach selection, spec writing
2. **Explore** — parallel codebase exploration with Explore agents
3. **Plan** — task breakdown with verification steps, TDD decision
4. **Build** — execute the plan, commit per task, claudekit health check
5. **Verify** — full test suite, typecheck, lint, AgentShield security scan
6. **Review** — 6 parallel review agents (silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier)
7. **Ship** — PR creation, registry capture, documentation

### Dev Tools

Run `./scripts/setup-dev-tools.sh` to install all of these:

| Tool | Purpose |
|------|---------|
| tdd-guard | Enforces test-first development via hooks |
| AgentShield | Security audit of Claude Code config |
| claudekit | Project health validation |
| ccpm | Spec-driven PM (PRDs, epics, GitHub issues) |

## Key Directories

| What | Where |
|------|-------|
| API routes | `apps/api/src/routes/` |
| DB schema | `apps/api/src/db/schema.ts` |
| Marketplace adapters | `apps/api/src/marketplace/` |
| Frontend pages | `apps/web/src/app/` |
| React hooks | `apps/web/src/hooks/` |
| Components | `apps/web/src/components/` |
| Shared types | `packages/shared/src/types.ts` |
| Tests | `apps/api/src/**/*.test.ts` |

## Production Rules

1. No placeholders, TODOs, or provisional logic.
2. View files before editing. Always.
3. Run verification after any change. Show proof.
4. One fix per hypothesis when debugging.
5. Planning and building are separate phases.
6. Never commit secrets.
7. Quality over speed. Always.

## Current State

See `docs/TODO.md` for the live roadmap, current task status, and test counts.

**Demo account:** demo credentials live in Doppler (never committed).
