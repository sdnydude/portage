# R1 Desktop Workbench — orchestration session (worktree setup → PR #237 → fix rounds)

**Span:** 2026-07-15 morning → 2026-07-17 · **Branch:** feat/ui-refactor · **PR:** #237 (open)

## Story

Session started as worktree setup: the onboarding build owned the main checkout, so UI-refactor work moved to `/home/swebber64/DHG/portage-ui-refactor` (deps, shared build, .env via user-run cp, certs). Stephen asked for the Responsive UI Program status, then an R1 implementation plan (`docs/superpowers/plans/2026-07-15-r1-desktop-workbench.md`, 7 TDD tasks): prop-driven `ItemDetail` extraction from the 1001-line `inventory/[id]` route, `MasterDetail` panes, `useListNav`, ItemCard button mode, inventory+listings integration, live gate.

Execution chose subagent-driven-development, and immediately hit the session's defining discovery: **tdd-guard validates against `CLAUDE_PROJECT_DIR`'s test.json, not the edited checkout's** — a main-rooted session cannot do TDD in a worktree (it was being judged against the onboarding build's test data). No env override exists in 1.7.0; the shared kill-switch would have disabled the guard for the concurrent onboarding session. Fix: run builds in sessions rooted IN the worktree. Stephen explicitly approved the headless `claude -p` pattern (auto-mode classifier rightly demanded explicit authorization, twice).

The headless build delivered Tasks 1–6 + whole-branch review + fix wave (9 commits, 482→485 unit tests). Gate 2 (frontend-verification) ran as a second headless session: committed `workbench.spec.ts` (8 scenarios), and the e2e immediately earned its keep — the workbench list pane inherited `xl:grid-cols-4` from the shared grid (Tailwind breakpoints key on viewport, not container), rendering card titles invisible at 380px. jsdom can't see it; the container run can. It also confirmed the pre-existing select-mode nested-Link bug (334daef2) live, shipping it as an honest `test.fixme` with a documented race trap (post-click assertions pass spuriously unless you settle on networkidle).

PR #237 went up with all local gates green. CI then failed Ephemeral e2e across seven old specs — Playwright's Desktop Chrome default (1280×720) now lands legacy specs on the lg workbench where the mobile layout they drive is `lg:hidden`. Stephen ordered both open items fixed. Two more headless rounds: `48432c5` (ItemCard `interactive={false}` kills the nested Link in select mode — desktop AND mobile; suite default viewport pinned to 800×900; scenario g un-fixme'd to pin the fix) and `86d7d8e` (ConfirmSheet finally gets `role="dialog"`; two spec locators de-ambiguated against the dual-mount DOM). The first fix session died silently by ending its turn while its background e2e ran — headless sessions terminate at end of turn; its uncommitted work was recovered and committed by the next round.

At session end: fix2's final verification still running (nohup survives), 2 commits unpushed, full handoff in `whats-next.md`.

## Learnings

- tdd-guard resolves its data dir from CLAUDE_PROJECT_DIR — worktree builds require a session rooted in the worktree; shared guardEnabled means a bypass punishes innocent concurrent sessions.
- Headless `claude -p` sessions terminate at end of turn: never let them "wait for a background-task notification"; verification must run in the foreground.
- Tailwind breakpoints key on viewport, not container — a component reused inside a narrow pane keeps its viewport-scoped grid classes; only live e2e catches the visual collapse.
- Dual-render responsive DOM (R0 idiom) breaks strict-mode text locators in Playwright and unscoped queries in jsdom — role-scoped or region-scoped queries are the contract.
- Playwright's default viewport is part of the app contract: introducing a desktop layout flipped seven green specs to red without touching them.
- Bash command-substitutes backticks inside double-quoted `claude -p` prompts in launcher scripts.
- Monorepo `next build` standalone output nests the full path (`standalone/DHG/<worktree>/apps/web/server.js`) — hand-assembling it is a dead end when a container build exists.

## Insights

- The two-writer worktree warning that opened the session (don't share a tree) recursed one level down: the tdd-guard data dir was the shared resource nobody isolated.
- An honest `test.fixme` with assertions intact converted a deferred bug into a one-commit fix with a ready-made regression test — cheaper than any bug report.

## Deferred

- fresh-scan-prepare + listing-hub-section specs still use live `exchangeSession()` (401-on-LAN flake source); port to Gate 2's session-stub recipe if flake persists.
- Registry deferred 334daef2 → mark resolved after #237 merges.
- Stale worktrees under `.claude/worktrees/` (onboarding shipped as PR #231) — cleanup candidate.
- Post-merge: rebuild :3002 from main; reconcile CLAUDE.md web test count (467 vs 485+).
