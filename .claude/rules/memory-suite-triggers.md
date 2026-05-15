# Memory Suite — Per-Turn Trigger Checklist

The memory suite is a PRIMARY resource, not a background system. Check these triggers on EVERY turn.

## Before responding to ANY user question

- [ ] **Does this question reference prior work, past decisions, or "how/why" something was built?**
  → Query registry KB: `curl -s -X POST http://10.0.0.251:8011/api/kb/search -H "Content-Type: application/json" -d '{"query":"...","project_name":"portage","limit":10}'`
  → Cite sources in your response: `[decisions/slug]`, `[ship_sessions/slug]`, `[docs/path]`

- [ ] **Does the question relate to something in memory files?**
  → Read the relevant memory file from `~/.claude/projects/-home-swebber64-DHG-portage/memory/`
  → Check MEMORY.md index for related entries

## After EVERY response that contains technical content

- [ ] **Did you output a `★ Insight` block?**
  → If yes: IMMEDIATELY post to registry via `post-insight.sh` — no exceptions, no batching
  → If you provided educational content but forgot the insight block: add the block, then post

- [ ] **Did you make or discuss an architectural/implementation decision where alternatives were considered?**
  → If all 3 criteria met (alternative rejected, future session could choose differently, non-obvious from code): post via `post-decision-logs.sh`

## On user correction signals

- [ ] **Did the user push back, correct, redirect, or express frustration?**
  → Trigger signals: "no", "stop", "don't", "you're wrong", "always do X", "never do Y", repeated instruction, ALL CAPS
  → Post via `post-correction.sh` ONCE per correction event

## At architecture/design decision points

- [ ] **Before proposing approaches:** Query registry for prior decisions in the same domain
- [ ] **After user selects approach:** Post decision log if criteria are met
- [ ] **When spawning architect/explorer agents:** Include instruction to check registry KB first

## Session awareness

- [ ] **Read the session briefing** — it was injected at SessionStart. Reference it when relevant.
- [ ] **Check memory files** when the topic touches a known area (design system, listing flow, ship pipeline, etc.)
- [ ] **Update memory files** when you learn something new about the user, project, or process that future sessions need

## The failure mode this prevents

The rules in `.claude/rules/auto-*.md` define WHAT to capture and HOW. This checklist defines WHEN — which is the gap. Without active per-turn checking, the triggers fire only when the pattern is extremely obvious, missing the majority of capturable moments.
