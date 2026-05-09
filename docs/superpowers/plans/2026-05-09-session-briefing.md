# SessionStart Briefing Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a bash hook that assembles and injects a context briefing at the start of every Claude Code session, pulling from 6 data sources to eliminate 2-3 minutes of cold-start re-orienting.

**Architecture:** Single bash script (`session-briefing.sh`) in `.claude/hooks/` reads 6 independent data sources (registry API, .remember files, decisions index, git state, TODO.md progress), prints structured labeled text to stdout. Each section is error-isolated with `|| true`. Registered as a second SessionStart hook after doppler-sync.sh.

**Tech Stack:** Bash, curl, jq (with python3 fallback), git CLI.

---

### Task 1: Create session-briefing.sh with script skeleton and registry section

**Files:**
- Create: `.claude/hooks/session-briefing.sh`

- [ ] **Step 1: Create the script file with header, opening banner, and Section 1 (Recent Sessions)**

```bash
#!/usr/bin/env bash
# SessionStart briefing — assembles context from 6 sources for Claude
# Each section is independent; failures skip that section silently

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "=== SESSION BRIEFING ==="
echo ""

# --- Section 1: Recent Sessions (from registry API) ---
(
  REGISTRY_URL="http://10.0.0.251:8011/api/agent-sessions?project=portage&limit=3"
  RESPONSE=$(curl -s --connect-timeout 3 --max-time 5 "$REGISTRY_URL" 2>/dev/null)

  if [ -n "$RESPONSE" ]; then
    if command -v jq &>/dev/null; then
      TLDRS=$(echo "$RESPONSE" | jq -r '.sessions[] | "\(.ended_at // "unknown") — \(.tldr // "no tldr")"' 2>/dev/null)
    else
      TLDRS=$(python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
for s in data.get('sessions', []):
    print(f\"{s.get('ended_at', 'unknown')} — {s.get('tldr', 'no tldr')}\")
" <<< "$RESPONSE" 2>/dev/null)
    fi

    if [ -n "$TLDRS" ]; then
      echo "--- Recent Sessions ---"
      echo "$TLDRS"
      echo ""
    fi
  fi
) || true
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`

- [ ] **Step 3: Test Section 1 in isolation**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: `=== SESSION BRIEFING ===` header, followed by `--- Recent Sessions ---` with 1-3 lines of session tldrs (or just the header if registry is empty/down)

---

### Task 2: Add Section 2 (Recent Activity) and Section 3 (Today's Journal)

**Files:**
- Modify: `.claude/hooks/session-briefing.sh`

- [ ] **Step 1: Append Section 2 — Recent Activity from .remember/recent.md**

Add after the Section 1 block:

```bash
# --- Section 2: Recent Activity (7-day rolling) ---
(
  RECENT_FILE="$PROJECT_DIR/.remember/recent.md"
  if [ -f "$RECENT_FILE" ] && [ -s "$RECENT_FILE" ]; then
    echo "--- Recent Activity (7-day) ---"
    cat "$RECENT_FILE"
    echo ""
  fi
) || true
```

- [ ] **Step 2: Append Section 3 — Today's Journal from .remember/today-YYYY-MM-DD.md**

Add after the Section 2 block:

```bash
# --- Section 3: Today's Journal ---
(
  TODAY_FILE="$PROJECT_DIR/.remember/today-$(date +%Y-%m-%d).md"
  if [ -f "$TODAY_FILE" ] && [ -s "$TODAY_FILE" ]; then
    echo "--- Today's Journal ---"
    cat "$TODAY_FILE"
    echo ""
  fi
) || true
```

- [ ] **Step 3: Test Sections 2 and 3**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: Briefing header, recent sessions (if registry up), recent activity section with .remember/recent.md content, today's journal section (if today file exists). Each section has its own labeled header.

---

### Task 3: Add Section 4 (Decision Log) and Section 5 (Git State)

**Files:**
- Modify: `.claude/hooks/session-briefing.sh`

- [ ] **Step 1: Append Section 4 — Decision Log from auto-memory**

Add after the Section 3 block:

```bash
# --- Section 4: Decision Log ---
(
  DECISIONS_FILE="$HOME/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md"
  if [ -f "$DECISIONS_FILE" ] && [ -s "$DECISIONS_FILE" ]; then
    echo "--- Decision Log ---"
    cat "$DECISIONS_FILE"
    echo ""
  fi
) || true
```

- [ ] **Step 2: Append Section 5 — Git State**

Add after the Section 4 block:

```bash
# --- Section 5: Git State ---
(
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$BRANCH" ]; then
    echo "--- Git State ---"
    echo "Branch: $BRANCH"
    git log --oneline -5 2>/dev/null
    echo ""
  fi
) || true
```

- [ ] **Step 3: Test Sections 4 and 5**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: All previous sections plus `--- Decision Log ---` with the decisions_index.md content and `--- Git State ---` showing current branch and last 5 commits.

---

### Task 4: Add Section 6 (Progress) and closing banner

**Files:**
- Modify: `.claude/hooks/session-briefing.sh`

- [ ] **Step 1: Append Section 6 — Progress from TODO.md**

Add after the Section 5 block:

```bash
# --- Section 6: Progress ---
(
  TODO_FILE="$PROJECT_DIR/docs/TODO.md"
  if [ -f "$TODO_FILE" ]; then
    PROGRESS=$(grep "^## Phase" "$TODO_FILE" 2>/dev/null)
    if [ -n "$PROGRESS" ]; then
      echo "--- Progress ---"
      echo "$PROGRESS"
      echo ""
    fi
  fi
) || true

echo "=== END BRIEFING ==="
```

- [ ] **Step 2: Test the complete script**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: Full output with all 6 sections (some may be skipped if data is missing) bookended by `=== SESSION BRIEFING ===` and `=== END BRIEFING ===`. Output should be ~50 lines.

- [ ] **Step 3: Time the script**

Run: `time bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh > /dev/null`
Expected: Under 1 second on happy path, under 5 seconds if registry curl times out.

---

### Task 5: Register the hook in settings.json

**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1: Add session-briefing.sh as second SessionStart hook**

The current SessionStart array has one hook entry (doppler-sync.sh). Add session-briefing.sh as a second hook in the same `hooks` array. The result should look like:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/swebber64/DHG/portage/.claude/hooks/doppler-sync.sh",
            "timeout": 15
          },
          {
            "type": "command",
            "command": "bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/swebber64/DHG/portage/.claude/hooks/memory-sync.sh",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "bash /home/swebber64/DHG/portage/.claude/hooks/session-capture.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/swebber64/DHG/portage/.claude/hooks/check-ports.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Timeout is 10 seconds (covers the 5s max registry curl timeout plus local file read overhead).

- [ ] **Step 2: Validate JSON syntax**

Run: `python3 -c "import json; json.load(open('/home/swebber64/DHG/portage/.claude/settings.json'))"`
Expected: No output (valid JSON)

---

### Task 6: End-to-end test and commit

**Files:**
- All files from Tasks 1-5

- [ ] **Step 1: Run the complete script and verify output format**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: Complete briefing output with labeled sections. Verify:
- Opens with `=== SESSION BRIEFING ===`
- Closes with `=== END BRIEFING ===`
- Each section has a `--- Section Name ---` header
- No errors or warnings in output
- Total output ~50 lines

- [ ] **Step 2: Test failure isolation — simulate registry down**

Run: `REGISTRY_URL_OVERRIDE=http://10.0.0.251:9999 bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`
Expected: Script still completes, recent sessions section is skipped, all other 5 sections populate normally. No error messages in output.

- [ ] **Step 3: Verify settings.json has both SessionStart hooks**

Run: `python3 -c "import json; d=json.load(open('/home/swebber64/DHG/portage/.claude/settings.json')); hooks=d['hooks']['SessionStart'][0]['hooks']; print(f'{len(hooks)} SessionStart hooks'); [print(f'  - {h[\"command\"].split(\"/\")[-1]}') for h in hooks]"`
Expected:
```
2 SessionStart hooks
  - doppler-sync.sh
  - session-briefing.sh
```

- [ ] **Step 4: Commit**

```bash
git add .claude/hooks/session-briefing.sh .claude/settings.json docs/superpowers/specs/2026-05-09-session-briefing-design.md docs/superpowers/plans/2026-05-09-session-briefing.md
git commit -m "feat: add SessionStart briefing hook for cold-start context injection

Bash hook reads 6 sources (registry session tldrs, .remember/ files,
decisions_index.md, git state, TODO.md progress) and prints a structured
briefing that Claude sees as a system message on session start.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
