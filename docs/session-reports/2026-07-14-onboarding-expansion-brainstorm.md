# Onboarding expansion — brainstorm to committed spec

**Session span:** 2026-07-14 midday
**Category:** docs (planning session, no product code)

## Story

Stephen opened with a new ask mid-ship: the existing first-run onboarding is good but should be improved and expanded — screenshots with animations and text, show-and-tell instructions for setting up Portage, adding items, viewing listings/inventory/orders, reviewing the settings panel, and using Porter AI chat. Explicit process request: brainstorm first, then plan. One correction landed early: **do not park the active photo-reorder ship** — the onboarding work queues behind it.

Ran the superpowers brainstorming flow in plan mode. Explored current state: onboarding is a 5-step carousel (`onboarding-flow.tsx`) with static SVG icons, shown once via `user.onboardingCompleted`, never re-viewable. Resolved five design forks with Stephen one at a time:

1. **Placement:** short first-run carousel + full Tutorial hub under More/Help (re-viewable) — over expanded-carousel-only or hub-only.
2. **Media:** real app screenshots + in-app animated overlays (highlight ring, tap ripple, callout, swipe arrow) — over GIF/video recordings (heavy, baked text, full re-record per UI change).
3. **Topics:** 8 — setup, adding items, listings, inventory, orders, settings tour, Porter AI, messages. Parsing note: "reviews" in the original ask was the verb (review the settings panel), not a feature — confirmed with Stephen; Messages added since it's a real shipped surface.
4. **Pipeline:** checked-in Playwright capture script (`npm run capture:tutorials`), demo account + seeded data, 390×844, capture manifests colocated with overlay coords so screenshots and annotations regenerate in sync — over manual capture (silent staleness).
5. **First-run carousel:** keep 5 steps + copy; swap SVG icons for device-framed screenshots + one overlay animation each; final step gains secondary "Explore tutorials" button.

Design approved as-is. Plan written and approved via plan mode. Spec committed to `docs/superpowers/specs/2026-07-14-onboarding-expansion-design.md` on new branch `docs/onboarding-expansion-spec` (ffff406) — created via `git worktree` from main so the dirty ship branch stayed untouched.

Session closed by refreshing `whats-next.md`: the stale camera-session handoff replaced with current dual-track state (PR #223 merge pending iPhone touch proof; onboarding build queued behind it).

## Learnings

- `git worktree add <scratchpad> -b <branch> main` is the clean way to commit docs to a fresh branch while the checked-out feature branch has a dirty tree — no stash, no checkout, zero ship-branch risk.
- The commit-message hook enforces a ≤72-char subject; em-dash titles overflow easily — draft short.
- Reading ship-state.md before writing a handoff caught that the photo ship had advanced from phase 4 to phase 7/PR #223 open since the session-start briefing — briefings snapshot, ship-state is live truth.

## Insights

- Capture manifests exported from the same per-topic module as overlay coordinates makes screenshot regeneration and annotation positions a single source of truth — the mechanism that prevents tutorial screenshot rot, not the script alone.

## Deferred

- Onboarding expansion build itself — starts after PR #223 merges; next steps are Stephen's spec review, then writing-plans breakdown, then /ship.
- Push/PR of `docs/onboarding-expansion-spec` branch (local-only right now).
- CLAUDE.md test-count line edits (4 files, uncommitted, already stale vs post-review 685/397).
