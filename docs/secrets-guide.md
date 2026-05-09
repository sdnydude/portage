# DHG Secrets Management Guide

All secrets for Digital Harmony Group projects live in **Doppler**. No more `.env` files in Apple Notes. No more copying keys between projects. One dashboard, one CLI, every server.

**Dashboard:** [secrets.digitalharmonyai.com](https://secrets.digitalharmonyai.com) (redirects to Doppler)

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   DOPPLER CLOUD                      │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ portage  │ │aifactory │ │ dhg-infra│  ... 5 more│
│  │          │ │          │ │ (shared) │            │
│  │ dev      │ │ dev      │ │ dev      │            │
│  │ stg      │ │ stg      │ │ stg      │            │
│  │ prd      │ │ prd      │ │ prd      │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │             │             │                   │
└───────┼─────────────┼─────────────┼───────────────────┘
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │g700data1│  │ server 2 │  │CF Workers│
   │  CLI    │  │  CLI     │  │  API     │
   └─────────┘  └──────────┘  └──────────┘
```

**Doppler** is the single source of truth. Every server pulls secrets from Doppler at runtime. If you change a secret in Doppler, the next time a service starts, it gets the new value.

---

## Your Projects

| Doppler Project | What It Covers | Secrets |
|----------------|----------------|---------|
| **dhg-infra** | Shared keys used across projects (API keys, Cloudflare) | 8 |
| **portage** | Inventory/marketplace app (API, web, DB, AI providers) | 41 |
| **aifactory** | AI Factory 3.5 platform + all sub-services | 74 |
| **medkb** | Medical knowledge base | 4 |
| **dhg-transcribe** | Transcription pipeline | 8 |
| **dhg-audio** | Audio analysis agent | 9 |
| **dhg-cognitive** | Cognitive agent | 7 |
| **dhg-monitoring** | Grafana, Prometheus, observability | 3 |

Each project has 3 environments: **dev**, **stg**, **prd**. Right now they all have the same values. As you move toward production, you'll differentiate them (different DB passwords, different API keys, etc.).

---

## Everyday Workflows

### "I need to start a service"

```bash
cd ~/DHG/portage
doppler run -- npm run dev:api
```

That's it. `doppler run` injects every secret as an environment variable into the process. No `.env` file needed.

For Docker:
```bash
doppler run -- docker compose up -d
```

### "I need to see what secrets exist"

```bash
# In Claude Code:
/secrets list

# Or in terminal:
doppler secrets
```

### "I need to add or change a secret"

```bash
# In Claude Code:
/secrets set EBAY_CLIENT_ID=my-new-key

# Or in terminal:
doppler secrets set EBAY_CLIENT_ID=my-new-key
```

This updates Doppler immediately. The `.env` file is also auto-synced.

### "I need to get a specific secret value"

```bash
# In Claude Code:
/secrets get OPENAI_API_KEY

# Or in terminal:
doppler secrets get OPENAI_API_KEY --plain
```

### "I need the same secret in a different project"

Don't copy it. If it's a shared key (API key, Cloudflare token), it should live in **dhg-infra** and you reference it from there. For project-specific secrets, set it directly in that project:

```bash
doppler secrets set MY_KEY=value --project aifactory --config dev
```

### "I set a secret in Doppler but my service doesn't see it"

Restart the service. `doppler run` injects secrets at startup time. If the process is already running, it has the old values. Restart it:

```bash
doppler run -- docker compose restart portage-api
```

Or in Claude Code, just run `/secrets sync` to update the local `.env` file.

---

## The .env File

You still have a `.env` file in each project. Here's how it fits in:

```
Doppler (source of truth)
    │
    ▼
.env file (local cache, auto-generated)
    │
    ▼
docker-compose / npm run dev (reads .env)
```

**The `.env` file is generated FROM Doppler, not the other way around.** Every time you start a Claude Code session in a project directory, the SessionStart hook runs `doppler secrets download` and overwrites `.env` with fresh values.

If you edit `.env` directly, your changes will be lost next session. Always edit in Doppler (via `/secrets set` or the dashboard).

### When do you need the .env file?

- **`doppler run -- <cmd>`** — Does NOT need .env. Injects directly.
- **`docker compose up` (without doppler run)** — Reads `.env` via `env_file:` in compose. Needs the file.
- **IDE / editor** — Some tools read `.env` for autocomplete or running tests. The file is there for them.

---

## Claude Code Integration

### Automatic (happens every session)

When you open Claude Code in a Doppler-configured project directory, the **SessionStart hook** runs automatically:

```
Session starts → doppler-sync.sh → downloads secrets → writes .env
```

You don't need to think about this. Your `.env` is always fresh.

### /secrets Skill

| Command | What It Does |
|---------|-------------|
| `/secrets` | List all secrets (names + truncated values) |
| `/secrets get KEY` | Show full value of a specific secret |
| `/secrets set KEY=value` | Create or update a secret, auto-sync .env |
| `/secrets delete KEY` | Remove a secret (asks for confirmation) |
| `/secrets sync` | Pull latest from Doppler → regenerate .env |
| `/secrets diff` | Show what's different between .env and Doppler |
| `/secrets search term` | Find a key by name across ALL projects |
| `/secrets projects` | List all 8 DHG Doppler projects |
| `/secrets switch project` | Point current directory at a different project |
| `/secrets env prd` | Switch to a different environment (dev/stg/prd) |
| `/secrets export` | Save secrets to .env.doppler-export backup file |
| `/secrets import file` | Upload a .env file into Doppler |
| `/secrets open` | Open Doppler dashboard in browser |

### Shell Aliases (in ~/.bashrc)

```bash
# Run any command with Doppler secrets injected
drun portage dev docker compose up -d
drun aifactory prd docker compose restart dhg-frontend

# Quick sync: pull latest secrets → .env
dsync
```

---

## Common Scenarios

### Adding a new API key to Portage

```bash
# 1. Set it in Doppler
/secrets set STRIPE_SECRET_KEY=sk_live_abc123

# 2. That's it. .env is auto-synced.
# 3. Restart the service that needs it
doppler run -- docker compose restart portage-api
```

### Rotating a shared key (like OPENAI_API_KEY)

```bash
# 1. Update in dhg-infra (the shared project)
doppler secrets set OPENAI_API_KEY=sk-new-key --project dhg-infra --config dev
doppler secrets set OPENAI_API_KEY=sk-new-key --project dhg-infra --config stg
doppler secrets set OPENAI_API_KEY=sk-new-key --project dhg-infra --config prd

# 2. Update in each project that has its own copy
doppler secrets set OPENAI_API_KEY=sk-new-key --project portage --config dev
doppler secrets set OPENAI_API_KEY=sk-new-key --project aifactory --config dev
# ... repeat for other projects that use it

# 3. Restart affected services
```

### Adding a new project to Doppler

```bash
# 1. Create the project
doppler projects create my-new-project --description "What it does"

# 2. Upload existing .env
doppler secrets upload .env --project my-new-project --config dev

# 3. Copy to stg and prd
doppler secrets download --project my-new-project --config dev --no-file --format env > /tmp/sync.env
doppler secrets upload /tmp/sync.env --project my-new-project --config stg
doppler secrets upload /tmp/sync.env --project my-new-project --config prd
rm /tmp/sync.env

# 4. Link the directory
cd ~/DHG/my-new-project
doppler setup --project my-new-project --config dev --no-interactive
```

### Setting up a new server

```bash
# 1. Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh -s -- --no-package-manager --install-path ~/.local/bin

# 2. Create a service token (from the primary server or dashboard)
doppler configs tokens create --project portage --config prd --name "server2-portage" --plain

# 3. On the new server, configure with the token
echo 'dp.st.prd.xxxx' | doppler configure set token --scope ~/DHG/portage

# 4. Now doppler run works without interactive login
cd ~/DHG/portage
doppler run -- docker compose up -d
```

---

## Security Notes

- **Never commit `.env` to git.** It's in `.gitignore` already. The file is a local cache.
- **Doppler encrypts at rest and in transit.** Your secrets are safer there than in a text file.
- **Service tokens are scoped.** Each token only accesses one project + one environment. A compromised token on server 2 can't read portage secrets if it only has an aifactory token.
- **The dashboard has audit logs.** You can see who changed what and when.
- **Backup:** Run `doppler secrets download --format env > .env.backup` periodically as a local encrypted fallback in case Doppler is unreachable.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│              DHG SECRETS CHEAT SHEET             │
├─────────────────────────────────────────────────┤
│                                                  │
│  See secrets:    /secrets  or  doppler secrets   │
│  Get one:        /secrets get KEY                │
│  Set one:        /secrets set KEY=value          │
│  Sync .env:      /secrets sync  or  dsync        │
│  Run with keys:  doppler run -- <command>        │
│  Switch env:     /secrets env prd                │
│  Dashboard:      secrets.digitalharmonyai.com    │
│                                                  │
│  Shell shortcut:                                 │
│  drun portage dev docker compose up -d           │
│                                                  │
└─────────────────────────────────────────────────┘
```
