# Decision Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `decision` memory type to the auto-memory system that records architectural choices with rejected alternatives and reasoning.

**Architecture:** Individual `decision_*.md` files in the auto-memory directory, indexed by a `decisions_index.md` sub-index pointed to from `MEMORY.md`. Proactive capture instructions added to CLAUDE.md. The `/sync-memory` command extended to audit decision files.

**Tech Stack:** Markdown files with YAML frontmatter. No new infrastructure.

---

### Task 1: Create decisions_index.md

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the sub-index file**

```markdown
# Decision Log Index

## api

## infra

## ops

## registry

## shared

## web
```

Empty domain sections ready to receive entries. No frontmatter — this is an index, not a memory.

- [ ] **Step 2: Verify the file exists**

Run: `cat ~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`
Expected: The domain headers above

---

### Task 2: Add MEMORY.md pointer

**Files:**
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/MEMORY.md`

- [ ] **Step 1: Add decision log entry to MEMORY.md**

Add this line at the top of MEMORY.md (before the first existing entry):

```markdown
- [Decision Log](decisions_index.md) — Architectural choices with rejected alternatives (0 entries)
```

- [ ] **Step 2: Verify MEMORY.md**

Run: `head -5 ~/.claude/projects/-home-swebber64-DHG-portage/memory/MEMORY.md`
Expected: Decision Log entry as first line, followed by existing entries

---

### Task 3: Seed decision — unified agent_sessions table

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_registry_unified_sessions.md`
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the decision file**

```markdown
---
name: Unified agent_sessions table
description: One table w/ source discriminator over per-agent tables for session tracking
type: decision
domain: registry
supersedes: null
---
One unified `agent_sessions` table with a `source` column discriminator (claude-code, scheduled-routine, subagent).

**Over:** Per-agent tables — separate tables for claude-code sessions, scheduled routines, and subagent runs.

**Because:** All three sources share identical schemas (session_id, project, branch, commits, summary, tldr). Per-agent tables only make sense when schemas diverge significantly. A `source` column handles filtering with simpler queries and no schema duplication.

**Context:** AI Factory session capture build. Registry already uses unified tables with type discriminators (e.g., Event.entity_type).
```

- [ ] **Step 2: Add to decisions_index.md**

Under the `## registry` section, add:

```markdown
- [Unified agent_sessions table](decision_registry_unified_sessions.md) — One table w/ source discriminator over per-agent
```

- [ ] **Step 3: Update MEMORY.md count**

Change `(0 entries)` to `(1 entries)` in the Decision Log line.

---

### Task 4: Seed decision — local cron over cloud routine

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_ops_local_cron_sync.md`
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the decision file**

```markdown
---
name: Local crontab for memory sync
description: Local crontab over cloud routine for /sync-memory automation
type: decision
domain: ops
supersedes: null
---
Local crontab entry running `claude -p "Run /sync-memory..."` at 6 AM ET daily.

**Over:** Cloud-based routine via Anthropic's remote agent infrastructure (CCR).

**Because:** All 5 memory systems (.remember/, auto-memory, CodeGraph, Serena, CLAUDE.md) store data on the local filesystem. A cloud routine runs in an isolated sandbox with no access to local files — it would need to clone the repo and couldn't reach the local Serena MCP, CodeGraph SQLite, or .remember/ directory.

**Context:** /sync-memory automation setup. The /schedule skill was initially invoked but the local-only constraint was identified before creation.
```

- [ ] **Step 2: Add to decisions_index.md**

Under the `## ops` section, add:

```markdown
- [Local crontab for memory sync](decision_ops_local_cron_sync.md) — Local cron over cloud routine; memory systems are local-only
```

- [ ] **Step 3: Update MEMORY.md count to (2 entries)**

---

### Task 5: Seed decision — bcrypt v6 upgrade path

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_api_bcrypt_v6.md`
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the decision file**

```markdown
---
name: bcrypt v6 major upgrade
description: Upgraded bcrypt 5→6 over patching tar vulnerability; eliminates dependency chain
type: decision
domain: api
supersedes: null
---
Upgraded bcrypt from v5 to v6, eliminating the vulnerable `tar` transitive dependency entirely.

**Over:** Patching tar via npm overrides while staying on bcrypt v5.

**Because:** bcrypt v5 depends on @mapbox/node-pre-gyp which pulls in tar (the vulnerable package). Patching tar with an override fixes the immediate CVE but leaves a fragile dependency chain that will produce future vulnerabilities. bcrypt v6 drops @mapbox/node-pre-gyp entirely — the whole dependency subtree disappears. One breaking change (ESM-only) vs. ongoing maintenance burden.

**Context:** Resolving 8 Dependabot vulnerabilities. The other 6 were fixed via npm overrides (postcss, esbuild) where major upgrades weren't feasible.
```

- [ ] **Step 2: Add to decisions_index.md**

Under the `## api` section, add:

```markdown
- [bcrypt v6 major upgrade](decision_api_bcrypt_v6.md) — v6 over patching tar; eliminates dependency chain entirely
```

- [ ] **Step 3: Update MEMORY.md count to (3 entries)**

---

### Task 6: Seed decision — session capture as fire-and-forget hook

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_ops_session_capture_hook.md`
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the decision file**

```markdown
---
name: Fire-and-forget session capture hook
description: Bash hook w/ curl over AI-generated summary; keeps session exit under 1 second
type: decision
domain: ops
supersedes: null
---
Session capture via a lightweight bash hook that curls the registry API with git-derived data (commits, file count, now.md content, commit subjects as tldr).

**Over:** AI-generated summary via Claude CLI call at session end.

**Because:** An AI summary adds $0.02-0.05 per session and 10-30 seconds of latency to every session exit. The bash hook runs in <1s with zero cost. Raw now.md content and commit subjects provide 80% of the summary value. The AI-generated summary can be added as a Phase 2 enhancement if the raw data proves insufficient.

**Context:** Building session capture for the AI Factory agent_sessions API. The hook runs alongside memory-sync.sh in the Stop event.
```

- [ ] **Step 2: Add to decisions_index.md**

Under the `## ops` section, add:

```markdown
- [Fire-and-forget session capture](decision_ops_session_capture_hook.md) — Bash curl over AI summary; <1s exit, zero cost
```

- [ ] **Step 3: Update MEMORY.md count to (4 entries)**

---

### Task 7: Seed decision — Doppler over self-hosted secrets

**Files:**
- Create: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_infra_doppler_over_vault.md`
- Modify: `~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`

- [ ] **Step 1: Create the decision file**

```markdown
---
name: Doppler over self-hosted secrets
description: Hosted Doppler SaaS over Infisical/Vault self-hosted; CEO can't ops infrastructure
type: decision
domain: infra
supersedes: null
---
Doppler Team ($18/mo) for all secrets management across 8 DHG projects.

**Over:** Self-hosted Infisical or HashiCorp Vault.

**Because:** Self-hosted Infisical was tried and failed — two broken installs, outdated CLI, broken Cloudflare proxy, secrets ended up in Apple Notes. Self-hosted infrastructure that requires maintenance rots when the operator is also the CEO building product. The $600/hr CEO time spent debugging self-hosted infra far exceeds any SaaS subscription cost.

**Context:** Infisical→Doppler migration completed week of 2026-04-20 (154 secrets, 8 projects). This decision applies to ALL DHG infrastructure tooling, not just secrets.
```

- [ ] **Step 2: Add to decisions_index.md**

Under the `## infra` section, add:

```markdown
- [Doppler over self-hosted secrets](decision_infra_doppler_over_vault.md) — Hosted SaaS over self-hosted; CEO can't ops Vault/Infisical
```

- [ ] **Step 3: Update MEMORY.md count to (5 entries)**

---

### Task 8: Update /sync-memory to audit decisions

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Extend Phase 3a in the sync-memory command**

In the `/sync-memory` slash command, update Phase 3a to include decision files. After the existing instruction "For each `project_*.md` memory file:", add a parallel block:

```markdown
For each `decision_*.md` memory file:
- Read the decision content
- Verify the chosen approach is still reflected in the codebase (check if key files/patterns still exist)
- If the code has diverged from the decision (e.g., the rejected alternative was later adopted), flag for review
- Check `supersedes` field — if this file is superseded by another decision, remove it from `decisions_index.md` but keep the file on disk
- Report what changed
```

- [ ] **Step 2: Add decisions_index.md rebuild to Phase 3c**

In Phase 3c (Rebuild MEMORY.md index), add after the existing rebuild instruction:

```markdown
Also rebuild `decisions_index.md`:
- Read all `decision_*.md` files in the directory
- Group by `domain` from frontmatter
- Skip any file that has been superseded (another decision's `supersedes` field points to it)
- Write entries organized by domain section
- Update the entry count in the MEMORY.md Decision Log pointer
```

- [ ] **Step 3: Verify the command file is valid**

Run: `wc -l /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: Line count increased from original (~93 lines) by approximately 15-20 lines

---

### Task 9: Add proactive capture instructions to CLAUDE.md

**Files:**
- Modify: `/home/swebber64/DHG/portage/CLAUDE.md`

- [ ] **Step 1: Add Decision Log section to CLAUDE.md**

Add a new section after the "Production Rules" section:

```markdown
---

## Decision Log

Record architectural and implementation choices as `decision_*.md` files in auto-memory when all three criteria are met:

1. An alternative was explicitly considered and rejected
2. A future session could plausibly make the opposite choice
3. The reasoning is non-obvious from the code alone

Format: `decision_{domain}_{slug}.md` with frontmatter (name, description, type: decision, domain, supersedes) and body (choice, **Over:** rejected alternatives, **Because:** reasoning, **Context:** when/where). Save silently — no need to announce. Update `decisions_index.md` and MEMORY.md count.

Domain values: `api`, `web`, `shared`, `infra`, `registry`, `ops`.
```

- [ ] **Step 2: Verify CLAUDE.md is syntactically valid**

Run: `grep -c "^##" /home/swebber64/DHG/portage/CLAUDE.md`
Expected: Section count increased by 1

---

### Task 10: Commit and verify

**Files:**
- All files created/modified in Tasks 1-9

- [ ] **Step 1: Verify all decision files exist**

Run: `ls ~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_*.md | wc -l`
Expected: 5

- [ ] **Step 2: Verify decisions_index.md has all entries**

Run: `grep -c "^\- \[" ~/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md`
Expected: 5

- [ ] **Step 3: Verify MEMORY.md pointer**

Run: `grep "Decision Log" ~/.claude/projects/-home-swebber64-DHG-portage/memory/MEMORY.md`
Expected: `- [Decision Log](decisions_index.md) — Architectural choices with rejected alternatives (5 entries)`

- [ ] **Step 4: Stage and commit**

```bash
git add CLAUDE.md .claude/commands/sync-memory.md docs/superpowers/
git commit -m "feat: add decision log memory type with 5 seed decisions

New decision memory type records architectural choices (chose X over Y
because Z) in auto-memory. Includes decisions_index.md sub-index,
/sync-memory audit integration, proactive capture instructions in
CLAUDE.md, and 5 seed decisions from recent work.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

Note: The auto-memory files (`decision_*.md`, `decisions_index.md`, `MEMORY.md`) are in `~/.claude/projects/` which is outside the git repo — they won't be in this commit. Only the CLAUDE.md instructions, sync-memory updates, and spec/plan docs are committed.
