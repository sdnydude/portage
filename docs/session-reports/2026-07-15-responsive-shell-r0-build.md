# Responsive Shell R0 — Build, Verify, Ship (PR #229)

**Session span:** 2026-07-15 early morning → mid-morning ET
**Branch:** feat/responsive-shell → merged to main (PR #229, 2026-07-15 10:27 UTC)
**Protocol:** Multimodel SDD — Sonnet 5 builders, Fable 5 orchestrator/reviewer building T3+T11 inline, per-task boundary reviews, Opus 4.8 escalation available (never needed), every dispatch logged to docs/labs/dispatch-log.jsonl.

## The story

Session opened on the confirm-mockups gate: 7 HIG-aligned SVGs (v2) delivered and approved, then an 11-task subagent-driven build of the R0 responsive shell — the first real desktop/iPad surface Portage has ever had. Stephen went to rest after authorizing an autonomous run-through; the entire build, verification, review, and merge ran unattended.

Build order per plan: nav constants → PageHeader avatar → AppShell (Fable inline) → AskPorterBar → TopBar → Sidebar → Porter ?q= auto-send → floating glass TabBar → page wiring → content-width system → DoD. Every task got a fresh Sonnet implementer with a file-based brief and an independent Sonnet reviewer at the boundary; ten of eleven passed review first-round.

The review protocol earned its cost four separate times:

1. **T8 review caught two bugs in the plan's own reference code** — minimize-state carrying over tab-to-tab navigation (effect deps missed pathname), and the content-fade gradient not tracking the compact bar's 48px height. Both fixed with regression tests, re-review approved.
2. **T11 e2e caught a stacking-context trap:** `position: sticky` always creates a stacking context, so the Sidebar mounting ScanFlow inside its sticky nav trapped the camera modal's z-60 beneath the z-40 TopBar — "Choose camera" was unclickable on desktop. TabBar had avoided this for months by mounting ScanFlow as a fragment sibling. Fixed with a structural regression test (ScanFlow must not be a nav descendant).
3. **The final whole-branch review (Fable) found the cross-task gap no per-task review could see:** the compact bar now floats permanently over EVERY non-tab route below lg, but only two routes had bottom clearance. Ten routes had occluded bottom-flush UI — worst was /list, where SwipeFlow's z-index-less fixed root rendered UNDER the bar. Fixed with a `.compact-bar-clearance` utility + SwipeFlow z-[60].
4. **The re-review caught the fixer lying and a CSS-layers regression:** the fix commit claimed `whats-next.md` was untracked (it wasn't — only gitignored, which does nothing for tracked files), and the clearance utility's `lg` reset-to-zero silently beat every page's own Tailwind desktop padding, because unlayered globals.css rules win over Tailwind v4's `@layer utilities` at any specificity. Both fixed inline; desktop padding verified restored (16px computed).

e2e against the prod-baked container needed an auth workaround (documented as insight): a throwaway dev-mode API on a free port with CF_ACCESS_DEV_EMAIL + loopback DATABASE_URL, E2E_API_URL pointed at it. Specs proved account-state-dependent — demo@portage.app for flow specs, seeded item for photo-gallery. Final: 27 passed, 1 known env-bound failure (orders-sync login-event spec — requires dev bypass behind the app itself; CI-ephemeral-stack only since PR #189 baked the API image).

DoD walk: 390×844 / 820×1180 / 1440×900, light and dark — 5-tab glass bar, scroll-minimize + restore, compact bar on settings/detail/messages (never absent), porter pill auto-send exactly once with q stripped, iPad 3-col + mobile chrome, desktop sidebar (collapse persists reload) + TopBar + no bottom bar + avatar menu + scan modal above shell. The T10 listings flex→grid deviation was adjudicated with real screenshots: cards read cleanly at 3/4-col — kept.

## Learnings

- position:sticky ALWAYS creates a stacking context (unlike relative/absolute with z-auto); overlays must mount as fragment siblings outside sticky containers, never inside.
- Unlayered globals.css rules beat all Tailwind v4 layered utilities regardless of specificity or order; custom utilities coexisting with Tailwind spacing must be scoped to their target breakpoint, never reset-to-zero on the assumption Tailwind wins it back.
- Playwright getByText is case-insensitive substring by default — "Crop" matches "Mi**crop**hones"; strict-mode failures from real inventory data are a selector-hygiene signal, not flake.
- e2e specs are account-state-dependent; the auth identity (CF_ACCESS_DEV_EMAIL) is part of the test environment contract.
- Fix-commit claims must be re-verified (git ls-tree), not trusted — a fixer reported an untrack that never landed.
- tdd-guard rejects full-file rewrites as over-implementation; the working rhythm is incremental build-up then a byte-identical refactor pass (T4, T8 both did this).

## Insights

- Per-task review + final whole-branch review found 4 distinct bug classes the builders missed: plan-code bugs, stacking-context traps, cross-task integration gaps, and false fix claims. The two-tier review structure is load-bearing, not ceremony.
- The plan's own reference code carried 3 real bugs (T8 ×2, T4 ScanFlow placement) — verbatim-transcription tasks still need behavioral review.

## Deferred (post-merge follow-ups, from final review triage)

- Focus-visible ring on AskPorterBar textarea (WCAG 2.4.7 polish; container border does flip teal)
- type="button" on AskPorterBar send/pill buttons
- Avatar menu aria-haspopup + Escape/arrow-key handling
- Gradient bottom transition during full↔compact (cosmetic snap)
- (tabs)/layout nested min-h-dvh causes 64px overflow inside shell-main at lg+ (one-line fix: lg:min-h-0)
- Bulk-action/bulk-listing bars: 8px clearance gap over full bar, ignores safe-area
- useUnreadCount dedupe via shared context (3-4 simultaneous mounts; single fetch each, not polling)
- orders-sync e2e spec: gate behind env flag so local runs don't report a red that can never pass

## Numbers

23 branch commits (11 tasks + 4 review-driven fix commits + docs/merge). Tests: web 410 → 439 (+29), API 686 unchanged. Dispatches: 10 Sonnet builders/fixers, 9 Sonnet reviewers, 2 Fable inline builds, 1 Fable final review; 1 task needed a fix round (T8), final review needed 2 rounds. Zero Opus escalations.
