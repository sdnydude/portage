# Session Report — Responsive Shell design + HIG alignment (2026-07-14 late → 07-15 early)

## The story

The session opened on a stale instruction — "get iPhone touch proof for PR #223, then merge" — but verification showed #223–#226 had ALL merged the previous evening and the iPhone proof had already passed on-device. Nothing to redo; the real work was next in queue: the onboarding expansion.

The onboarding arc completed its planning lap: spec branch pushed (PR #228), an 11-task TDD implementation plan written with full code, then the proven pre-build gate — parallel adversarial architect + engineer reviews (both APPROVE-WITH-FIXES). The reviewers caught real defects: a carousel height blowout that would bury the CTA on iPhone SE, a zero-precedent async-server-component test pattern (flagged with a proven fallback), two fabricated premises in the plan's own prose, a dead Tailwind class, and duplicated session-stub logic. All fixes applied; plan published as an artifact.

Then Stephen pivoted: before onboarding, the app must go fully responsive — desktop, iPad, mobile polish — because the tutorial screenshots must capture the new shell, and a native iOS app follows both. A long brainstorm (superpowers:brainstorming, one question at a time) produced a phased program: R0 shell → R1 master-detail workbench → R2 drag-drop ingest → R3 Porter dock → R4 QR phone-camera handoff. Four product ideas grounded in the phone-as-capture / desktop-as-throughput split (QR handoff, workbench, drag-drop ingest, Porter dock) were folded into the phases. Stephen's own counter-proposals sharpened it: Ask Porter input on list pages (tuned from always-3-lines to focus-expanding), sidebar carrying more destinations than the bar.

Mid-design, Stephen ordered an Apple HIG research pass (iOS version planned). The research validated the floating-glass direction (it IS the iOS 26 Liquid Glass default) but contradicted three specifics: 6 tabs (HIG: ≤5), the center Scan FAB (no Apple pattern — kept as documented deviation), and the lone Home chip (HIG model: the bar is never fully absent — replaced by a compact minimized bar). Stephen approved the package. A first research pass left four pages UNVERIFIED (Apple's HIG is a JS SPA); Stephen called it out hard, and the closure came via Apple's JSON data endpoints (`/tutorials/data/design/human-interface-guidelines/<page>.json`) — every gap either verified or confirmed absent from HIG itself.

Process innovations shipped alongside: a multimodel build protocol (Sonnet 5 builders, Fable orchestrating/reviewing, Opus 4.8 escalation after two failed reviews) with a Labs dispatch log (`docs/labs/dispatch-log.jsonl`) capturing model/effort/turn-type/tokens per dispatch; a hard repo rule for tdd-guard (ONE test per Write/Edit — repeated token-burn correction); and "manager mode" — the final HIG fold-in ran as three parallel Sonnet dispatches (gap closure, plan sweep, mockup updates) while Fable only orchestrated. The sweep agent caught a genuine design conflict (PageHeader's action slot would suppress the new avatar) and flagged it instead of guessing; the orchestrator resolved it (side-by-side).

Seven SVG mockups (desktop expanded/collapsed, iPad, iPhone tab-page and compact-bar page, phase-labeled R1/R3 end-state) were authored from real design tokens, updated to the HIG package by an agent, and committed. Session closed with a complete, reviewed, build-ready R0 on `feat/responsive-shell` — build starts next session.

## Learnings

- Apple's HIG website is a JS SPA — plain fetches return scaffolding; the underlying `/tutorials/data/.../<page>.json` endpoints return full body prose. Reusable technique.
- HIG publishes NO numeric layout-margin values for iOS/iPadOS anywhere — that gap is Apple's, not a research miss. Only tvOS/visionOS carry numbers.
- iPadOS windowed apps must adapt to a continuous size range ("defer switching to compact view as long as possible") — CSS breakpoints are a HIG-compatible implementation technique, not what HIG prescribes.
- Apple's accessory shelf is an ongoing-task surface (now-playing bar), not navigation — parking settings there misreads the idiom; header avatar is the native settings placement.
- Caveman mode saves ~nothing on build-heavy sessions (<1% — prose is the only thing it compresses); its value is discussion-heavy sessions. Real build levers: one-test rule, cheaper builders, effort tiers, cache-stable prompts.
- A subagent that flags a conflict instead of silently picking (PageHeader action-vs-avatar) is the multimodel protocol working as designed — resolution is the orchestrator's job.

## Insights

- Phone = capture device, desktop = throughput device: the responsive design derives from this split, and the phased features (QR handoff, workbench, drag-drop, dock) all fall out of it.
- The shell layout language is 2026-standard (Linear/Notion-class, now Apple-canonized); Portage's differentiation is the seller-workflow-with-AI-in-the-loop wiring, not the chrome.
- Multimodel cost estimate for R0: Sonnet-builds+Fable-reviews ≈ 27% cheaper than Opus-builds, ≈ 47% cheaper than Fable-solo (volume ~1.4–1.6M tokens; tdd retries are the variance driver — hence the hard rule).

## Deferred

- dhg-app-shell template extraction (post-R0, Portage as reference implementation) — registry item.
- Ollama-builder experiment (next ship; this ship generates the Claude-only baseline) — needs script harness, only viable for one-shot mechanical turn types.
- Porter conversation history UI → Phase R3 (endpoints exist unused).
- Scoped Cache-Control exception for /tutorials/** PNGs (low, perf-only).
- Keyboard shortcuts; hover row-actions/table views — unscheduled.
- Onboarding-expansion build — queued behind R0; re-verify capture manifests against the new shell before executing.
