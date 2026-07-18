# R0 follow-ups + onboarding tutorial hub build — 2026-07-15 (afternoon)

Two arcs in one session: the R0 responsive-shell deferral batch (PR #230), then the full onboarding-expansion build (PR #231), both merged and deployed the same day the plan's blocker (R0) shipped.

## Arc 1 — R0 follow-up batch (PR #230)

Stephen's triage verdicts executed on `fix/r0-followups`: focus-visible ring on the AskPorterBar textarea, avatar-menu ARIA (haspopup, Escape-with-refocus, arrow-key cycling), gradient bottom transition tracking the tab bar, `lg:min-h-0` killing the 64px shell-main overflow, bulk-bar safe-area clearance, and the biggest item — `useUnreadCount` deduped through a shared `UnreadCountProvider` in AppShell (3–4 simultaneous badge fetches → exactly 1, proven live by counting network requests). The orders-sync e2e spec was gated `E2E_ORDERS_SYNC=1` — and narrowed after the first pass gated too broadly: only the login-trigger case is environmentally impossible locally; the two mocked specs still run. Wiring the flag into the ephemeral-e2e workflow gave the login-trigger spec its first-ever CI green.

CodeRabbit round: 3 findings fixed (ArrowUp-from-trigger focuses last item; tokenless consumers no longer report loading forever; the CI env var), 1 rejected with live proof (its bulk-bar padding reading was geometrically backwards).

## Arc 2 — Onboarding expansion (PR #231)

The 11-task plan ran inline after Stephen declined the subagent dispatch. Mid-build he asked for his checkout back, so the build relocated to a git worktree — which surfaced a real workflow gap: **tdd-guard's hook reads the launch directory's test.json while the worktree's vitest reporter writes to the worktree root**, so the guard saw "no test output" and blocked every Write. Stephen approved bridging the data file with a symlink (removed at build end).

Everything in the plan shipped: 8 React-free topic modules each exporting content + a Playwright capture manifest, schema-rail tests that auto-cover later topics, DeviceFrame with 4 CSS overlay animations + reduced-motion guard + error placeholder, TutorialPlayer, `/tutorials` hub, `/tutorials/[topic]` (the codebase's first async server-component page — the plan's `render(await Page(...))` spike technique worked first try), entry points in More/Help/carousel, the carousel upgraded from icons to compact device frames, and the capture pipeline that regenerated all 24 PNGs from the live app as the demo account.

The user-directed "re-verify capture manifests against the new shell" pre-flight found one real break before any code ran: the plan's porter fill selector (`textarea, input[type='text']`) now matches the CSS-hidden TopBar AskPorterBar textarea first, because the R0 shell keeps desktop chrome React-mounted at mobile widths. Deviations applied: input-tag-scoped porter selector + `visible=true` filters in the capture script. Both proven necessary live.

Verification caught three real bugs the suites missed:
- The floating tab bar occluded the player's Next button on the new non-tab routes (R0's occlusion class — fixed with `.compact-bar-clearance`; caught by the committed e2e, not by unit tests).
- Callouts rendered off-center: a CSS animation's `transform` keyframes *replace* the inline `translateX(-50%)` rather than composing — centering moved into the keyframes.
- Every overlay's `animationDelay` was dead in real browsers: the `animation` shorthand later in the style object resets `animation-delay`. jsdom doesn't emulate this, so the unit test passed while browsers dropped the stagger. (CodeRabbit caught this one.)

First capture run also photobombed itself: the demo account still had onboarding incomplete, so `scan-home.png` captured the carousel overlay instead of the home screen. Completed the flag, recaptured, and restored the account's original state after the DoD walk.

CodeRabbit round 2: 12 comments — 6 fixed (the delay bug, sticky placeholder across step changes, rejection-safe Explore-tutorials chain, non-empty-id rail, capture-script try/finally + surfaced skip count, honest e2e title), 4 rejected as plan-design (fail-closed captures for documented empty demo states), 2 informational.

## Incidents

- A bare `git stash apply` with an empty SHA variable (the tag-grep ran in the wrong directory — harness cwd resets between commands bit twice this session) applied a foreign June stash onto the worktree: 178 files of conflicts and strays including a secrets backup. Recovery: `reset --hard` + targeted removal, verified every stray against the stash entry's payload first — the entry itself was intact (apply, never pop), stack count unchanged.
- Stephen's uncommitted `apps/web/CLAUDE.md` R0 doc updates blocked the post-merge pull; reconciled with a tagged stash push → pull → apply → drop. The 3-way merge combined his R0 content with the merged capture-gotcha line cleanly. Those CLAUDE.md updates are still uncommitted — they should land in a docs commit soon.

## Learnings

- CSS animation keyframes replace, never compose with, inline transforms — any transform-positioned + transform-animated element must carry the positional component in every keyframe.
- The `animation` shorthand resets `animation-delay`; longhand must follow shorthand in React style objects. jsdom does not emulate either behavior — pixel-level animation bugs need browser eyes, not jsdom assertions.
- tdd-guard and git worktrees don't compose out of the box: hooks run from the launch dir, reporters write relative to the test run. Bridge the data file or build in the main tree.
- Playwright bare `.first()` is a trap in the R0 shell: CSS-hidden desktop chrome is React-mounted at mobile widths — filter `visible=true`.
- Screenshot capture against a stateful account is order-dependent: onboarding flags, seeded items, and empty states all change what "the app" looks like. Pin account state before capturing, restore after.

## Insights

- Verification layers earned their keep in inverse order of cost: unit tests caught nothing the plan didn't already encode; the committed e2e caught the occlusion; the human-eye DoD walk caught the two CSS bugs.
- CodeRabbit's fail-closed suggestions for capture scripts conflict with intentional skip-and-reuse designs — the resolution (count + surface skips, keep exit 0) preserves both signals.

## Deferred

- Bulk-mode capture for `inventory/bulk.png` — blocked by the select-mode nested-Link bug (card body tap navigates; registry-logged, high priority).
- Orders/messages detail captures reuse empty-state frames until the demo account has orders/conversations; re-run `npm run capture:tutorials` then.
- Richer demo-account inventory (1 seeded item today) for marketing-grade tutorial screenshots.
- Stephen's uncommitted CLAUDE.md R0 doc updates need a docs commit.

## Numbers

PRs #230 + #231 + #228 (spec) merged. Tests: web 439 → 467 (+28 across both arcs), api 686 unchanged. e2e: orders-sync first CI green; new tutorials spec committed. 24 tutorial PNGs captured, inspected, committed. 2 CodeRabbit rounds, 9 findings fixed, 5 rejected with rationale.
