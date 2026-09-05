---
id: tdd-guard
title: tdd-guard — The Original Gate
sidebar_position: 3
---

# tdd-guard

**The proof-of-concept for the entire Trust Gates layer.** Months before the 2026-07-27 escalation, tdd-guard was already demonstrating that a discipline enforced by a validator *never drifts*, while the same discipline stated as prose drifts constantly.

## What it is

A PreToolUse validator (plugin `tdd-guard@tdd-guard`, enabled in `~/.claude/settings.json`) that intercepts every `Write`/`Edit` and **rejects the tool call** when the change violates the TDD contract. The rejected edit never lands; the rejection text explains precisely what to do instead. Active on **both** `apps/api` and `apps/web` — web is not exempt.

## The contract it enforces

1. **One test per write.** Every edit that adds tests adds exactly ONE `it`/`test` block — never batches, not for "related" tests, not in new files. (Hard rule: `.claude/rules/tdd-one-test-per-write.md` — a token-burn rule as much as a process rule: rejected multi-test content plus the retry costs more than the one-at-a-time rhythm.)
2. **Red before implementation.** New behavior requires a failing test first; the guard reads test output freshness from `.claude/tdd-guard/data/test.json` (populated by `npm run test -w apps/api` — running vitest directly does not refresh it).
3. **Minimal implementation.** Code beyond what the failing assertion demands is rejected as over-implementation — including "obviously correct" additions like an untested success-path reset.
4. **Stub-first on missing symbols.** When a test fails with "X is not a function", the sanctioned step is an empty stub, re-run, then implement against the real assertion failure.

## The rhythm, per increment

```
add ONE test (small Edit, not full-file Write)
→ run (confirm red, or green for a guard-rail test pinning code it ships with)
→ minimal implementation
→ run (green)
→ next test
```

## Observed on 2026-07-27 (installation day for the other gates)

The guard rejected the agent **three times** in one session — each rejection correct:

| Rejection | What it caught |
|---|---|
| Auth-hardening breaker, first draft | Full exponential backoff + success-reset written when only the cooldown assertion was red — forced stub-first, then per-assertion growth |
| Breaker success-reset | `.then()` reset added with no test demanding it — the success-reset test was written first instead |
| Publish-route ads block | Reverb bump branch bundled into the eBay-test implementation — split, tested separately |

It also caught a **test-harness defect** the agent had misread as an implementation gap: a 500 (missing DB mock in the test's select queue) was about to be "fixed" in route code; the guard's push-back on the implementation led to finding the missing `mockSelectOnce` instead.

## Friction modes and fixes

Documented in memory (`reference_tdd_guard_playbook`); the short list:

- **"not a function"** → stub first, don't implement.
- **Validator hedges on a compliant single-test edit** → retry the SAME edit verbatim once; never rewrite it larger.
- **Cohesive object assertions** → `toEqual` on the whole object in one step beats field-by-field test inflation.
- **Full-file Writes** trip the validator's max-turns — use small Edits.
- **Worktrees**: the validator resolves its data dir from `CLAUDE_PROJECT_DIR`, not the edited file's checkout — worktree builds need the session launched *in* the worktree.

## Standing policy

Never disabled for friction or speed (`feedback_tdd_guard_enforcement`). A scoped, auto-reverted bypass exists (`/tdd-guard-bypass` skill) requiring a reason, a re-enable point, and proof — used rarely, logged always.
