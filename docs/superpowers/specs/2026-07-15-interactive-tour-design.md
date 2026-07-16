# Interactive First-Run Tour — Design Spec

**Locked with Stephen 2026-07-15.** Replaces the screenshot carousel at first run; the carousel survives only as the tutorials hub's "Replay intro". Build in a fresh session off this spec.

## What it is

A live, in-app guided tour: spotlight the real UI element, explain it in an anchored coach-mark, and **gate advancement on the user actually performing the action**. Not screenshots — the running app.

## Locked decisions

1. **Stops — 5-stop core loop** (light actions, ~2 min, no marketplace account required):
   | # | Spotlight target | Coach-mark copy theme | Completion signal |
   |---|---|---|---|
   | 1 | Scan button (tab bar / sidebar) | Scan anything — AI identifies it | ScanFlow opened (then user may close it) |
   | 2 | Inventory tab | Your catalog lives here | Inventory route visited |
   | 3 | First item card | Every item has a detail hub | Item detail route visited |
   | 4 | Porter tab + input | Ask in plain English | A Porter question submitted (send fired; reply may stream) |
   | 5 | More → Marketplace Accounts | Connect eBay/Reverb when ready | Marketplace settings route visited |
2. **Gating — mandatory stops, Exit allowed.** Next is locked until the stop's completion signal fires. A small "Exit tour" affordance always exists; exiting stores progress and the tour is resumable from the tutorials hub ("Resume tour" replaces "Replay intro" when a tour is in progress).
3. **Carousel fate — replaced.** First-run (`onboardingCompleted=false`) mounts the tour, not OnboardingFlow. Completing or exiting stop 5 marks onboarding complete (same PATCH as today).

## Architecture sketch

- `TourProvider` (context, mounted in AppShell): current stop, completion signals, persistence (`users.onboardingCompleted` + a `tour_progress` localStorage key for mid-tour resume).
- Stop registry (React-free data like `src/lib/tutorials/`): target selector/anchor id, copy, completion event name.
- Completion signals via a tiny event bus (`tour.emit("scan-opened")` etc.) — instrument the 5 touchpoints with one-line emits; no coupling to tour UI.
- Spotlight: fixed overlay with a cutout (mask around the target's boundingRect, recomputed on resize/route change); coach-mark anchored to the rect; must work across R0 breakpoints (targets differ: TabBar vs Sidebar — stop registry carries per-breakpoint anchors).
- Respect reduced motion; z-index above shell chrome but below ScanFlow's z-[60] when the modal opens (tour pauses while a modal covers it).
- Zero-error visual bar applies: every stop's spotlight/coach-mark reviewed on 390×844, 768×1024, 1440×900 before ship.

## Non-goals (v1)

- No hard lock (user can always exit), no multi-tour authoring UI, no server-side per-stop analytics (localStorage only; analytics later).

## Verification plan

- Unit: stop registry rails; provider gating logic (can't advance without signal); resume logic.
- Committed e2e: full tour walk on the dev-bypass stack — perform each action, assert gate unlocks, exit/resume, completion flips the flag.
- DoD: live walk at 3 viewports, every coach-mark visually reviewed.
