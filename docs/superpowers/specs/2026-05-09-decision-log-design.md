# Decision Log — Design Spec

A new `decision` memory type in the auto-memory system that records architectural and implementation choices with rejected alternatives and reasoning. Prevents contradictory decisions across sessions and serves as a human-readable engineering journal.

## Problem

Every Claude Code session produces judgment calls — technology choices, data model designs, pattern selections, rejected alternatives. When the session ends, the *what* is captured (commits, session logs) but the *why* is lost. Future sessions may contradict prior decisions because they have no record of what was considered and rejected.

Existing memory types don't cover this:
- `feedback` = behavioral rules for Claude ("don't guess UIs")
- `project` = milestones and current state ("Reverb adapter implemented")
- `reference` = pointers to external systems ("bugs tracked in Linear")

None capture "chose X over Y because Z."

## Design

### File Format

Each decision is a standalone file in the auto-memory directory:

```
~/.claude/projects/-home-swebber64-DHG-portage/memory/decision_{domain}_{slug}.md
```

Structure:

```markdown
---
name: Short decision title
description: One-line — chose X over Y for Z reason
type: decision
domain: api|web|shared|infra|registry|ops
supersedes: decision_file_it_replaces.md or null
---
[What was chosen — one sentence.]

**Over:** [What was rejected — alternatives considered.]

**Because:** [Reasoning — trade-offs, constraints, evidence. Emphasize
the reasoning flaw of the rejected option, not just why the winner is good.]

**Context:** [Feature or task where this came up. Date is in file mtime.]
```

### Naming Convention

`decision_{domain}_{slug}.md`

- **domain:** `api`, `web`, `shared`, `infra`, `registry`, `ops`
- **slug:** 2-4 word kebab-case descriptor

Examples:
- `decision_registry_unified_sessions.md`
- `decision_infra_doppler_over_vault.md`
- `decision_api_bcrypt_v6_upgrade.md`
- `decision_web_wasm_bg_removal.md`

### Index Strategy

Individual decisions are NOT indexed directly in `MEMORY.md`. Instead, a single entry in `MEMORY.md` points to a sub-index:

```
- [Decision Log](decisions_index.md) — Architectural choices with rejected alternatives (N entries)
```

`decisions_index.md` is organized by domain:

```markdown
# Decision Log Index

## api
- [bcrypt v6 upgrade](decision_api_bcrypt_v6_upgrade.md) — v6 over patching tar; eliminates dependency chain
- [Unified sessions table](decision_registry_unified_sessions.md) — One table w/ source discriminator over per-agent

## infra
- [Doppler over Vault](decision_infra_doppler_over_vault.md) — Hosted SaaS over self-hosted; CEO can't ops Vault

## web
- [WASM background removal](decision_web_wasm_bg_removal.md) — Client-side @imgly over server rembg Docker
```

The entry count in `MEMORY.md` is updated when decisions are added.

### Supersession

When a decision is overturned:

1. Create a new decision file explaining the reversal
2. Set `supersedes: decision_old_file.md` in the new file's frontmatter
3. The `/sync-memory` audit detects superseded files and removes them from `decisions_index.md`
4. The superseded file is NOT deleted — it stays on disk for history — but is no longer indexed

### Capture Threshold

Three questions, all must be yes for proactive capture:

1. **Did I explicitly consider and reject an alternative?** — If there was only one obvious path, it's not a decision worth logging.
2. **Would a future session plausibly make the opposite choice?** — If no reasonable person would choose differently, it's not worth recording.
3. **Is this choice non-obvious from reading the code alone?** — If the code makes the reasoning self-evident, a decision record adds no value.

Examples that pass: "Chose local crontab over cloud routine because memory systems are local-only." A future session could easily default to cloud.

Examples that fail: "Put the shipping routes in `routes/shipping.ts`." No one would reasonably debate this.

### Proactive Capture Behavior

When Claude makes a significant choice during a session:

1. Evaluate against the three threshold questions
2. If all pass, save the `decision_*.md` file immediately
3. Add the entry to `decisions_index.md`
4. Update the count in the `MEMORY.md` pointer
5. No announcement needed — just save it silently as part of the work

Claude does NOT ask "should I log this?" — the threshold criteria are the gate. The user can always say "log that decision" to force-capture something that didn't pass the threshold, or "don't log that" to prevent a save.

### /sync-memory Integration

Phase 3a (stale memory audit) extends to cover decision files:

- For each `decision_*.md`, verify the chosen approach is still reflected in the codebase
- If the code has diverged (e.g., we switched from the chosen approach), flag it for review
- Check `supersedes` chains — if a superseded file is still indexed, remove it
- Rebuild `decisions_index.md` to match actual files on disk

### Boundary with Feedback Memories

- **Feedback** = behavioral rule ("never guess UIs", "always use parallel agents")
- **Decision** = architectural choice ("chose Doppler over Vault", "unified table over per-agent")

When something could be either: if it primarily tells Claude *how to behave*, it's feedback. If it primarily records *what was built and why*, it's a decision. Existing feedback memories stay as-is — no migration.

## Implementation Phases

### Phase 1: Local Auto-Memory (this spec — build now)

1. Add `decision` type definition to the auto-memory system prompt (the `<types>` block in the agent's system instructions that defines user/feedback/project/reference)
2. Create `decisions_index.md` in the memory directory
3. Add the MEMORY.md pointer entry
4. Update `/sync-memory` Phase 3a to audit decision files and rebuild `decisions_index.md`
5. Seed 3-5 decisions from this session's work (unified sessions table, local cron over cloud routine, bcrypt v6 over tar patch, session capture hook design)
6. Add proactive capture behavior to session instructions

No new infrastructure, no new APIs, no new database tables. The structured frontmatter format is designed to migrate cleanly to Phase 2.

### Phase 2: Centralized Registry API (future)

Move decisions from local files to the AI Factory registry for cross-project access:

- **`decisions` table** in the registry database with columns matching the frontmatter fields (name, description, domain, project, supersedes, chose, over, because, context)
- **REST API endpoints** following the existing registry pattern (`/api/decisions` — CRUD + query by project/domain), added as another router like `agent_sessions`
- **Client SDK** — a simple bash script or Python client that any project's hooks can call to log/query decisions
- Migration from Phase 1 is a data copy, not a redesign — the frontmatter fields map 1:1 to table columns

### Phase 3: Cross-Project Intelligence (future)

Add value-add features on top of the centralized API:

- **Cross-project decision search** — "has any DHG project already decided on an auth pattern?"
- **Decision conflict detection** — "Project A chose Prisma, Project B chose Drizzle — flag for review"
- **Decision analytics** — which domains accumulate the most decisions, which get superseded fastest, decision velocity per project
