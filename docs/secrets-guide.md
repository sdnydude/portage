# DHG Secrets Management

All DHG secrets live in **Doppler** — one dashboard ([secrets.digitalharmonyai.com](https://secrets.digitalharmonyai.com)), one CLI, every server. The `.env` file is a local cache generated *from* Doppler: the Claude Code `SessionStart` hook regenerates it every session, so always edit secrets in Doppler (via `/secrets set` or the dashboard), never in `.env` directly.

**Canonical guide (full workflows, `/secrets` skill reference, security practices):**
[Doppler — Secrets Management](http://10.0.0.251:8017/infrastructure/doppler/) on the DHG docs site.

## Portage quickstart

```bash
cd ~/DHG/portage
doppler run -- npm run dev:api        # start a service with secrets injected
doppler run -- docker compose up -d   # full stack with secrets injected
dsync                                 # pull latest secrets → regenerate .env
```

## Preserved here (not on the canonical page)

**`/secrets export`** — save secrets to a `.env.doppler-export` backup file. **`/secrets import file`** — upload a `.env` file into Doppler.

**Backup:** run `doppler secrets download --format env > .env.backup` periodically as a local fallback in case Doppler is unreachable.

**Adding a new project to Doppler:**

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

**Setting up a new server:**

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
