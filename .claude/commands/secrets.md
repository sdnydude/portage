# /secrets — Doppler Secrets Management

Manage secrets via Doppler CLI without leaving Claude Code.

The user may have provided a subcommand: $ARGUMENTS

## Commands

Parse $ARGUMENTS to determine which command to run:

### `list` or no arguments
Show all secrets for the current project (directory-scoped via `doppler setup`).
```bash
doppler secrets
```

### `get <KEY>`
Get a specific secret value.
```bash
doppler secrets get <KEY> --plain
```

### `set <KEY>=<VALUE>` or `set <KEY> <VALUE>`
Set or update a secret. Confirm the project/config before writing.
```bash
# Show what project/config this will affect
doppler configs --json 2>/dev/null | head -5
# Then set
doppler secrets set <KEY>=<VALUE>
```
After setting, run the sync hook to update .env:
```bash
bash .claude/hooks/doppler-sync.sh
```

### `delete <KEY>`
Delete a secret. **Ask for confirmation first** — show the current value and which project/config will be affected.
```bash
doppler secrets delete <KEY>
```
Then sync: `bash .claude/hooks/doppler-sync.sh`

### `sync`
Pull latest secrets from Doppler and regenerate .env.
```bash
bash .claude/hooks/doppler-sync.sh
```

### `diff`
Compare current .env file against what Doppler has. Show keys that are missing, extra, or have different values.
```bash
# Download Doppler secrets to temp file
doppler secrets download --no-file --format env 2>/dev/null | grep -v "^DOPPLER_" | sort > /tmp/doppler-secrets-sorted.env
# Sort local .env
grep "^[A-Z_].*=" .env 2>/dev/null | sort > /tmp/local-env-sorted.env
# Diff
diff /tmp/local-env-sorted.env /tmp/doppler-secrets-sorted.env
rm -f /tmp/doppler-secrets-sorted.env /tmp/local-env-sorted.env
```

### `projects`
List all Doppler projects in the DHG workspace.
```bash
doppler projects
```

### `switch <project> [config]`
Switch the current directory to a different Doppler project/config.
```bash
doppler setup --project <project> --config <config|dev> --no-interactive
```

### `env <config>`
Switch environment (dev/stg/prd) for the current project.
```bash
doppler setup --config <config> --no-interactive
```
Then sync: `bash .claude/hooks/doppler-sync.sh`

### `export [project] [config]`
Export secrets as .env file for backup or transfer. Saves to `.env.doppler-export`.
```bash
doppler secrets download --project <project|current> --config <config|dev> --no-file --format env > .env.doppler-export
echo "Exported to .env.doppler-export"
```

### `import <file>`
Import a .env file into the current Doppler project/config.
```bash
doppler secrets upload <file>
```
Confirm the project/config before uploading.

### `search <term>`
Search for a secret by partial key name across all projects.
```bash
for proj in $(doppler projects --json 2>/dev/null | python3 -c "import json,sys; [print(p['id']) for p in json.load(sys.stdin)]" 2>/dev/null); do
  result=$(doppler secrets download --project "$proj" --config dev --no-file --format env 2>/dev/null | grep -i "<term>")
  if [ -n "$result" ]; then
    echo "=== $proj ==="
    echo "$result"
  fi
done
```

### `open`
Open Doppler dashboard in browser.
```bash
doppler open
```

### `help`
Show this command list.

## Notes
- All commands use the directory-scoped project/config set by `doppler setup`
- After any write operation (set/delete/import), auto-sync .env via the hook
- Never display full secret values in output unless the user explicitly asks with `get`
- When listing, Doppler truncates values by default — that's fine for overview
