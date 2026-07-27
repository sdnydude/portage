---
id: operations
title: Operations & Playbook
sidebar_position: 5
---

# Operations

## Where everything lives

| Artifact | Path | Scope |
|---|---|---|
| codegraph-first hook | `~/.claude/hooks/codegraph-first.sh` | Global (g700data1), active where `.codegraph/` exists |
| graph-memory-first hook | `~/.claude/hooks/graph-memory-first.sh` | Global, active where `.codegraph/` or `graphify-out/` exists |
| Hook registration | `~/.claude/settings.json` → `hooks.PreToolUse` (matchers `Bash\|Grep`, `Agent\|Task`) | Global |
| tdd-guard | plugin `tdd-guard@tdd-guard` + `.claude/tdd-guard/` data dir + `.claude/rules/tdd-one-test-per-write.md` | Per-repo config, both app workspaces |
| Overlay audit | `apps/web/e2e/tabbar-overlay-audit.spec.ts` | Repo, runs in required CI check |
| This escalation's memory trail | auto-memory `feedback_definition_of_done` (proof delivered + class-not-instance), registry `corrections`/`insights` (2026-07-27) | Cross-session |

Inspect live hooks any time with the `/hooks` menu — they are visible operator state, not agent memory.

## Verification protocol for any new gate

Every gate installed on 2026-07-27 went through all five steps; treat them as required:

1. **Dedup check** — read the target settings/config first; never blind-merge.
2. **Pipe-test every branch** with synthetic stdin payloads before registration:
   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"grep -rn foo apps/api/src"}}' \
     | ~/.claude/hooks/codegraph-first.sh; echo "exit=$?"   # expect 2
   ```
   (codegraph-first: 10 cases across Bash/Grep branches; graph-memory-first: 4 dispatch cases.)
3. **Schema-validate the registration**:
   ```bash
   jq -e '.hooks.PreToolUse[] | select(.matcher=="Bash|Grep") | .hooks[].command' ~/.claude/settings.json
   ```
   Malformed JSON silently disables *every* setting in that file.
4. **Live-fire** — trigger the real violating action in-session and watch the block land.
5. **Red-proof** (gates with a "green" state): reintroduce the real defect, watch the gate FAIL, restore. Green is only meaningful after red has been observed.

## Modifying or disabling

- **Hooks:** edit the script (takes effect next tool call — no restart) or remove its `settings.json` entry. `disableAllHooks: true` is the global kill-switch — never use it casually; it also kills memreg capture and tdd-guard.
- **tdd-guard:** never disabled for friction (standing policy). Scoped bypass only via `/tdd-guard-bypass` — reason + re-enable point + proof, auto-reverted.
- **Overlay audit:** it's a spec — skipping it means editing it out of a PR, which reviewers see. That visibility is the design.

## False-positive triage

A gate FP costs one reworded command; treat FPs as tuning input, not cause for disabling:

1. Confirm it's a real FP (the block message quotes what matched).
2. Work around now: split the compound command / reword prose in heredocs / use `python3` file reads.
3. Log it (registry insight or the FP table in [Search & Discovery Gates](./search-discovery-gates.md#false-positives)).
4. Tighten the regex only with the full pipe-test suite re-run.

## Adding the next gate — candidates already designed

| Candidate | Layer | Status |
|---|---|---|
| **Screenshot-proof pre-push**: block `git push` when the diff touches `apps/web` UI files unless screenshots newer than the changes exist under `test-results/proof/` | pre-push / PreToolUse `Bash(git push*)` | Designed 2026-07-27, awaiting go-ahead |
| Heredoc-aware rewrite of codegraph-first (strip `<<EOF` bodies before matching) | hook internals | Backlog |
| Session-exchange storm alarm (rate-limit 429 on `/auth/session` → Prometheus alert) | monitoring | Backlog — pairs with the PR #263 fixes |

## The one-line summary

**If a behavior has been corrected twice, it is in the wrong layer.** Move it down: prose → per-turn injection → hook/CI gate. The gates on this page are what that migration looks like when it's finished.
