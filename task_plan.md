# Task Plan: Replace Infisical with Doppler

**Goal:** Centralize all DHG secrets in Doppler, eliminate .env file sprawl, kill Apple Notes as a secrets store, tear down broken Infisical.

**Decision:** Doppler (hosted) over self-hosted — the user has proven that self-hosted secrets infra rots when unattended. Zero-ops wins.

---

## Phase 0: Doppler Account & Org Setup
> Get the foundation right before touching any project.

- [ ] 0.1 Sign up for Doppler (doppler.com) — create DHG org
- [ ] 0.2 Install Doppler CLI on g700data1: `curl -Ls https://cli.doppler.com/install.sh | sudo sh`
- [ ] 0.3 Authenticate CLI: `doppler login`
- [ ] 0.4 Create Doppler projects matching active stacks:
  - `portage`
  - `aifactory`
  - `medkb`
  - `dhg-transcribe`
  - `dhg-audio`
  - `dhg-cognitive`
  - `dhg-monitoring` (shared Grafana/Prometheus passwords)
  - `dhg-infra` (Cloudflare tokens, shared API keys, tunnel creds)
- [ ] 0.5 Set up environments per project: `dev` / `prod` (start simple, add staging later)

## Phase 1: Migrate Shared Secrets First
> OPENAI_API_KEY in 10 places is the pain — fix that first.

- [ ] 1.1 Create `dhg-infra` project in Doppler with shared secrets:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_ZONE_ID`
  - `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`
  - Any other cross-project keys
- [ ] 1.2 Set up Doppler "configs" for shared secrets that individual projects can inherit

## Phase 2: Migrate Portage (Pilot Project)
> Prove the workflow on the project we're actively developing.

- [ ] 2.1 Import Portage .env into Doppler: `doppler secrets upload .env --project portage --config prod`
- [ ] 2.2 Verify all 41 keys imported correctly
- [ ] 2.3 Update docker-compose.yml — remove `env_file: .env`, add Doppler:
  ```yaml
  # Option A: doppler run wraps compose
  # doppler run --project portage --config prod -- docker compose up -d
  
  # Option B: generate .env from Doppler
  # doppler secrets download --project portage --config prod --no-file --format env > .env
  ```
- [ ] 2.4 Test: bring Portage stack up via Doppler, verify all services healthy
- [ ] 2.5 Rename `.env` to `.env.backup` (keep until confirmed working)
- [ ] 2.6 Add `.env` to `.gitignore` if not already there

## Phase 3: Migrate Remaining Active Projects
> Same pattern as Phase 2, one project at a time.

- [ ] 3.1 aifactory3.5 (~100 keys — largest, do carefully)
- [ ] 3.2 dhg-transcribe (~8 keys + sub-service configs)
- [ ] 3.3 medkb
- [ ] 3.4 dhg-audio
- [ ] 3.5 dhg-cognitive
- [ ] 3.6 monitoring stack (Grafana admin pw, Prometheus config)
- [ ] 3.7 plane (if self-managed secrets)
- [ ] 3.8 pgadmin, uibakery

## Phase 4: Cloudflare Workers Integration
> For when Workers need secrets (future, but set up the path now).

- [ ] 4.1 Create Doppler service token for Cloudflare integration
- [ ] 4.2 Document the `wrangler secret` workflow using Doppler as source of truth
- [ ] 4.3 (Future) Set up Doppler → Cloudflare sync if using Workers at scale

## Phase 5: Tear Down Infisical
> Only after everything runs on Doppler.

- [ ] 5.1 Stop Infisical containers:
  - `cd ~/DHG/aifactory3.5/infisical && docker compose down`
  - `cd ~/infisical-stack && docker compose down`
- [ ] 5.2 Remove Infisical volumes (after confirming no unique data):
  - `docker volume rm infisical_pg_data infisical_redis_data`
  - `docker volume rm infisical-stack_infisical_postgres_data infisical-stack_infisical_redis_data`
- [ ] 5.3 Remove `.infisical.json` from aifactory3.5
- [ ] 5.4 Remove Infisical CLI: `sudo apt-get remove infisical`
- [ ] 5.5 Remove `secrets.digitalharmonyai.com` DNS record from Cloudflare
- [ ] 5.6 Clean up Google OAuth app if it was only for Infisical

## Phase 6: Multi-Server Rollout
> Extend to other servers once g700data1 is solid.

- [ ] 6.1 Install Doppler CLI on each additional server
- [ ] 6.2 Create service tokens (one per server per project) — no interactive login on remote servers
- [ ] 6.3 Set up `doppler run` in each project's start script or compose wrapper
- [ ] 6.4 Document the "new server" playbook: install CLI → set token → doppler run

## Phase 7: Cleanup & Hardening
> Polish pass after everything works.

- [ ] 7.1 Audit: ensure no .env files contain secrets that aren't in Doppler
- [ ] 7.2 Create shell alias or wrapper script: `drun` = `doppler run --project $1 --config $2 --`
- [ ] 7.3 Add Doppler to Cloudflare tunnel ingress if you want a dashboard shortcut (optional)
- [ ] 7.4 Set up Doppler audit log alerts (paid tier)
- [ ] 7.5 Delete Apple Notes secrets entries (the whole point)
- [ ] 7.6 Back up Doppler export locally as emergency fallback: `doppler secrets download --format env`

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Doppler hosted over self-hosted | Infisical self-hosted rotted for weeks. Hosted = zero ops. |
| 2 | One Doppler project per stack | Matches docker-compose boundaries. Clear ownership. |
| 3 | `dhg-infra` for shared secrets | OPENAI_API_KEY in 10 projects = single source of truth needed |
| 4 | Portage as pilot | Actively developing it, fastest feedback loop |
| 5 | Tear down Infisical LAST | Don't remove until replacement is proven |
| 6 | Service tokens for remote servers | No interactive login on headless servers |

## Risks

| Risk | Mitigation |
|------|-----------|
| Doppler outage blocks container restarts | Phase 7.6: local encrypted backup export |
| Free tier limit (5 projects) | 8 projects planned → will need Team tier ($18/user/mo) |
| Secrets in git history from old .env commits | Rotate critical keys (API keys, JWT secrets) after migration |
