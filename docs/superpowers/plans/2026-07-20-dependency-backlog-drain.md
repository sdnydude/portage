# Dependency Backlog Drain — Implementation Plan

**Date:** 2026-07-20 (revised same day after dependabot reorganized the PR set)
**Scope:** open dependabot PRs + 1 non-dependabot PR (#222). Zero open GitHub issues.
**Live-verified:** PR states, CI verdicts, and grouped-PR contents pulled fresh 2026-07-20.

## Context correction

Dependabot reorganized the backlog on 2026-07-20: it now **groups** minor/patch bumps and **recreated the majors fresh** (#243–249), superseding the older stale scoped PRs (#53, #55, #160, #163, #216–219). The earlier "single-lock drift → RED" story is largely **obsolete** — the new PRs are lock-synced. Remaining friction is the branch-protection strict-head dance, not lockfiles.

## Branch-protection reality (unchanged)

`main` is `strict:true` + `enforce_admins:true`. `update-branch` silently no-ops and lags the PR head pointer (proven on #242). Reliable merge path: merge origin/main locally → push → if the PR head lags, push an empty commit to force GitHub to re-point + re-run CI on a current head → `gh pr merge --admin`. Budget for this per branch.

## Group A — Merge now (CLEAN + verified green)

No code change, lock-synced, mergeable immediately.

- **#243** actions/setup-node 6 → 7 (CI action)
- **#246** grouped minor-and-patch, 9 updates — @anthropic-ai/sdk 0.112.3, @aws-sdk/client-s3, express-rate-limit 8, fast-xml-parser 5, openai 6, stripe 22, @types/supertest 7, @tailwindcss/postcss 4 (all non-major)
- **#249** @types/node 22 → 26 (type-only)

Merge each via the strict-head flow. **Order: #246 first** (it bumps @anthropic-ai/sdk, subsuming #244), then #243, #249. After #246 merges, verify a full `test:api` + `test -w apps/web` + `typecheck` on main — 9 grouped bumps touch prod deps (stripe, openai, aws-sdk, express-rate-limit), so confirm nothing regressed even though CI was green.

## Group B — Close as superseded / redundant (no merge)

- **#244** @anthropic-ai/sdk 0.112.3 — same bump as #246 → close once #246 lands.
- **#216** @types/node (web) — superseded by #249.
- **#160 / #163** p-limit 3 → 7 — `p-limit` is declared in `apps/api/package.json` but **imported nowhere in src**. Don't migrate: either close both, or open a tiny branch to **remove the unused dependency** outright (verify no dynamic/script use first).
- **#217 / #218 / #219** old scoped eslint/vitest/typescript — superseded by the fresh #247 / #245 / #248.

## Group C — Majors to verify (BLOCKED, green content, no lockfile problem)

Each is a fresh, lock-synced major. BLOCKED = strict-head, not RED. Still needs a real green run + possible small fixes; own branch each.

- **#247** eslint 9 → 10: flat config already in place (`apps/web/eslint.config.mjs`). Run `npm run lint`, fix newly-enforced rules.
- **#245** vitest 3 → 4 (api): **verify tdd-guard still parses `test.json` output shape after the bump** (`reference_tdd_guard_config`) before relying on it. Run full `test:api`. If web vitest is not also bumped, watch for a version split across workspaces.
- **#248** typescript 5 → 7: two-major jump on a live app. Run `typecheck` across all workspaces, fix new diagnostics. **Consider deferring** — a 5→6 intermediate step is safer if diagnostics are heavy; decide after seeing the typecheck output.

## Group D — Real migration work, no fresh replacement PR (deferred, optional)

These two majors were NOT recreated in the #243–249 batch; the stale PRs are the only vehicle.

- **#55** pino-http 10 → 11 (`apps/api/src/app.ts:56`): rebase/recreate, read v11 changelog (option renames), run the API, **hit an endpoint and confirm request logs still emit**.
- **#53** zod 3 → 4 (**22 files** in apps/api, DIRTY/conflicted): the real migration — `.default()`/error-map/`.strict()`/parse-behavior changes. Own session: typecheck-driven per-file fixes, full `test:api`, then **drive a validation-heavy route live** (create-listing schema at `apps/api/src/routes/listings.ts:171`).

## Group E — Non-dependabot: #222 ECC bundle

Adds `.claude/`, `.codex/`, agent-config, ECC tooling. Not a dep bump — **hold**, review contents, decide independently.

## Sequencing

1. Security-CVE check against target versions (5 registry-tracked vulns) → reprioritize if any close a CVE.
2. Group A merges (#246 → #243 → #249) + post-merge full-suite check on main.
3. Group B closes (#244, #216, #217, #218, #219; decide p-limit remove-vs-close).
4. Group C majors individually (#247, then #245 with tdd-guard re-verify, then #248 or its 5→6 fallback).
5. Group D optional real work (pino-http live-log check; zod 4 own session).
6. Every merge uses the #242-proven current-head + admin flow.
7. Runtime-touching bumps (Group A prod deps, Group D) require run-the-app observation before "done" (DoD rule).

## Outcome

3 immediate merges, ~5 closes as superseded, 3 majors to verify, 2 optional real migrations (zod 4 + pino-http 11), 1 non-dep held. The lockfile-regen work in the prior draft is no longer needed for the current PR set.
