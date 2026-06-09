status: in_progress
phase: 4
branch: feat/redesign-ship1-dhg-home
dev_verify_url: http://10.0.0.251:3003 (HMR dev server; container untouched on :3002)
resume_here: |
  Phase 4 BUILD, Ship 1. T1 ✅ DONE+VERIFIED (light authed + dark, warm-stone/graphite, de-greened darks,
  typecheck clean, 0 console errors, Etsy collision avoided by construction). CORS: EXTRA_CORS_ORIGINS=
  http://10.0.0.251:3003 added to docker-compose.override.yml portage-api + container recreated (verify on
  :3003 works now). NOW AT T2 (build real (tabs)/porter/page.tsx, reuse FullChat). Then T3→T7.
  --- (historical) ---
  T1 (globals.css DHG tokens light+dark+@theme+.glass-nav, 4 edits) is
  WRITTEN + TYPECHECK CLEAN + light-mode verified (warm-stone bg + graphite text on login/unauth :3003).
  Etsy badge collision avoided by construction (tints named -soft, never added --color-orange-50/teal-50).
  BLOCKED on authed+dark verification: prod API CORS rejects the :3003 dev origin.
  OPEN DECISION (user choosing): (A) add EXTRA_CORS_ORIGINS=http://10.0.0.251:3003 to portage-api + restart
  (fast HMR, app container stays up, reversible) — RECOMMENDED; or (C) rebuild portage-app container per
  task and verify on :3002 (no API change, slow). app.ts:44 EXTRA_CORS_ORIGINS is the additive hook.
  NEXT once env chosen: verify T1 (authed home + listings + dark, no green-tint) → commit T1 → T2 (/porter
  page) → T3 (tab bar 6+Scan) → T4-T7 (home redesign per chunk2_APPROVED_2advisor). Full task specs in
  ship1_plan above. tdd-guard SUSPENDED for apps/web (re-enable after Ship 1).
  BG PROCESSES: Next dev server on :3003 (HMR, http); mockup http.server on :8099 — both can be killed on resume.
  T1 is committed as a WIP checkpoint on branch feat/redesign-ship1-dhg-home (NOT yet visually verified).
feature: Redesign port — port approved mockups (Porter home + scan-review) and DHG design system into Portage apps/web (+ backend for pricing/settings in later ships)
approach: TBD (Phase 1 — choosing DHG adoption scope + ship breakdown)
complexity: complex
source_artifacts:
  - docs/voice-chat-mockups/porter-home-redesign.html
  - docs/voice-chat-mockups/scan-review-redesign.html
dhg_palette:
  graphite_ink: "#2D2A26"
  charcoal_darkUI: "#3A3836"
  deep_teal_AI: "#0D7377"
  orange_CTA: "#F77E2D"
  warm_stone_bg: "#F5F2EB"
  success_money: "#0F9D58"
verified_phase1:
  - "globals.css (314 lines) themes whole app via CSS tokens (--forest-green +variants, --background #F8F7F4, --text-primary/surface/border, --accent-*) mapped through @theme inline. Fonts already DHG."
  - "Components consume tokens via Tailwind classes (bg-forest-green, text-text-primary, border-border) — confirmed in scan-flow.tsx."
  - "eBay weight/dims BACKEND merged to main via PR #101; pending frontend (old ship T7-T11) is subsumed by this port's scan-review weight/dims UI."
prior_ship_versioned: .claude/ship-state_v4_ebay-weight-dims.md

tdd_guard:
  status: SUSPENDED for apps/web (frontend) during Ship 1 — user-approved 2026-06-09.
  mechanism: added "**/apps/web/**" to .claude/tdd-guard/data/config.json ignorePatterns.
  rationale: Ship 1 is pure UI (tokens/home/tab-bar/porter page); gate is drive-the-app screenshot verification, not unit tests. *.css/*.html were already exempt.
  scope: apps/api (backend) REMAINS guarded — exemption is apps/web only.
  RE-ENABLE_REMINDER: remove "**/apps/web/**" from ignorePatterns after Ship 1 merges (or before any apps/web work that has unit-testable logic, e.g. Ship 2 pricing-band helpers). Re-confirm with user at Ship 2 start.

approach_locked:
  dhg_scope: HYBRID — swap neutral token VALUES app-wide (background→warm stone, text→graphite, border→taupe, accent-success→#0F9D58) + ADD teal/orange/graphite/warm-stone tokens; keep --forest-green; migrate forest-green→accent split per redesigned screen.
  porter_tab: BUILD real (tabs)/porter/page.tsx as full Porter chat page in Ship 1 (reuse FullChat/StreamingMessage/usePorter).
  ship_breakdown:
    - "Ship 1: DHG tokens (hybrid) + Porter home redesign + tab bar 6+Scan + real /porter page"
    - "Ship 2: Scan-review redesign (scan-flow.tsx) — closes old eBay weight/dims frontend T7-T11. INCLUDE inline Item specifics (aspects) section: mirror listing-preview-card pattern (AI pre-fill + useRequiredAspects + required highlighting), so aspects are captured at scan time in-panel (not deferred to aspect-fill-sheet backstop). DEPENDENCY: resolve eBay categoryId in scan flow (free-text Category today) before aspects can be required-checked. Mockup currently omits an aspects section — update scan-review mockup with one before Ship 2 planning."
    - "Ship 3: Pricing engine (p25/p75 + bands + Best-Offer auto-accept) + settings (percentiles, footer) + Save&List ebayPublishMode fix"
    - "Ship 4: eBay-setup nav trap + dynamic per-category condition"

phase2_filemap:
  modify:
    - "apps/web/src/app/globals.css (315ln) — SOLE theme source (no tailwind.config). :root vars + @theme inline mappings + dark via @media prefers-color-scheme. Add DHG tokens + swap neutrals; keep --forest-green."
    - "apps/web/src/app/(tabs)/home/page.tsx — all-client; RESTYLE existing sections (Porter input+ActionPills, 3-col stats grid, eBay-price-check row, listings grid+filter chips) to graphite-hero/teal/orange. Data via useDashboard (displayName, stats.activeListings, portfolio.totalValueRecommended/totalItems, recentListings[])."
    - "apps/web/src/components/layout/tab-bar.tsx — 4 tabs+Scan → 6+Scan (add Listings→/listings, Porter→/porter). glass-regular→glass-thick. h-16/pb-20/bottom-16 height math moves together."
    - "apps/web/src/app/(tabs)/porter/page.tsx — currently redirect-to-/home STUB; rebuild as real full Porter chat page."
    - "apps/web/src/app/(tabs)/layout.tsx — pb-20 may need bump if nav grows; --tab-bar-height(5rem) orphaned, optionally wire."
  reuse:
    - "Glass: .glass-thick/.glass-regular/.glass-thin + .glass-fallback (globals.css 232-274). Tab bar already glass."
    - "Fonts wired via next/font in app/layout.tsx (--font-instrument/-plus-jakarta/-jetbrains)."
    - "Animations: spring-in, slide-up, fade-in, slide-up-full (globals.css 148-201) + prefers-reduced-motion block."
    - "Hooks: useDashboard, useAuth, useUnreadCount, useListings."
    - "Porter: ActionPills, StreamingMessage, FullChat, full-chat.tsx (reuse for /porter page)."
  surprises:
    - "(tabs)/porter is a redirect stub — no real expanded view (DECIDED: build it in Ship 1)."
    - "(tabs)/listings exists & works — Listings tab just needs array entry."
    - "Zero tests assert colors/snapshots/home/tab-bar — retheme can't break suite (verified, 10 unit + 3 e2e files, none relevant)."
    - "Dark mode = prefers-color-scheme; every new token needs a dark variant."
    - "--accent-success currently == forest-green #2D5A27; swap to DHG #0F9D58."
    - "formatCurrency() is local to home/page.tsx (not shared)."
  defer_candidates:
    - ".prose-porter code references undefined --muted-bg (pre-existing minor bug) — NOW FIXED in Ship1 T1 (add --muted-bg: var(--muted))."

ship1_plan:
  tdd: "no test-first (apps/web UI, tdd-guard suspended); gate = drive-app screenshot light+dark per task."
  advisor_pass: "general-purpose advisor reviewed Chunk 1 — 3 blockers + 6 important accepted; rejected I5 (graphite-night: keep COOL #15181B to match approved de-browned hero, advisor cited stale mockup token)."
  chunk1_APPROVED:
    - "T1 globals.css DHG tokens ATOMIC (light+dark one commit): swap neutrals incl warm dark --surface #1A1713/--surface-elevated #221E1A + warm dark glass-bg rgba(26,22,18,..); add --warm-stone/--graphite/--charcoal, --hero-top #262A2D/--hero-bottom #15181B, --teal(+bright/dark/soft), --orange(+bright/dark/soft), --muted-bg:var(--muted), --glass-nav-bg(warm)+.glass-nav utility. ADVISOR-ADDED (Chunk2 dep): --on-forest #EEF6F5 (light text on graphite hero), --on-forest-mute #9FC9C8, --glass-control rgba(255,255,255,.10) (dark-hero glass card). @theme inline EXACT: --color-{teal,teal-bright,teal-dark,teal-soft,orange,orange-bright,orange-dark,orange-soft,graphite,charcoal,warm-stone,on-forest,on-forest-mute}. NOTE: tints named -soft NOT -50 to avoid shadowing Tailwind default teal-50/orange-50 (Etsy badges use bg-orange-50/950). Verify light+dark screenshots + Etsy badge unaffected."
    - "T2 build real (tabs)/porter/page.tsx (replace redirect) reusing FullChat/StreamingMessage/usePorter. MUST land before T3 links the tab. Verify /porter renders+sends."
    - "T3 tab-bar 6+Scan (Home/Inventory/Listings | Scan | Porter(teal)/Orders/More) + FloatingMic guard !isHome && !startsWith('/porter') + apply warm .glass-nav to nav + check pb-20/h-16/bottom-16 clearance in (tabs)/layout.tsx. Verify light+dark, no overlap, Porter→real page, Listings→/listings."
  chunk2_APPROVED_2advisor:
    - "T4 graphite Porter hero + ask card. Hero gradient --hero-top→--hero-bottom, rounded-b-32, overflow-hidden for aurora. Teal orb w/ breathe-ring pseudo + blurred teal aurora (add @keyframes breathe + aurora-spin to globals.css; ADD both to prefers-reduced-motion block). Greeting getGreeting()+data.displayName (Instrument Sans, italic --orange name). Ask = warm-glass card (--glass-control). EXPLICIT LIGHT-TEXT OVERRIDE MAP (else dark-on-dark): greeting→--on-forest-mute, displayName→--on-forest, expand-btn icon, settings gear, proactive bubble text, input placeholder → light. ActionPills: wrap with local --forest-green→var(--teal) override (don't edit shared component); sync mini Porter avatar forest-green→teal. ENGAGED container (bg-surface) gets distinct glass/surface so border doesn't vanish in dark. MIC (orange, option A): reuse useVoiceInput exactly like FloatingMic — onPointerDown voice.start(token from useAuth), onPointerUp voice.stop(), useEffect send voice.transcript→porter.sendMessage on state==='done'. Add aria-label to mic + send. Verify: drive /home idle AND engaged (type+send, streaming readable) light+dark."
    - "T5 value/stats band + eBay price check. Band is a SIBLING of hero (NOT child) with -mt + relative z-30 (avoids hero overflow-hidden clip). Portfolio value JetBrains Mono + orange $, Listed/Items secondary, warm-white card. OMIT '+$420 this week' delta — NO weekly-delta field in useDashboard (fabrication; defer real delta to Ship 3 dashboard field). eBay Price Check row → teal icon tile. Hero gets delineating box-shadow (esp. dark, hero vanishes on near-black bg). Value band dark-mode variant. Verify light+dark."
    - "T6 listings grid + filter chips. ADD 'active' to STATUS_BADGE (currently only sold/draft/archived → active shows NO badge today). Token map: active=success #0F9D58, draft=orange, sold=deep-green, archived=taupe. Status tag top-right (mockup) not top-left. Filter chips selected=--graphite, inactive=transparent+taupe border. 'See all' + teal chevron. KEEP paddingBottom:100% (iOS aspect bug). Chip focus-visible ring. Verify light+dark."
  chunk3:
    - "T7 polish + Ship1 completion. Staggered entrance (animation-delay ladder hero→ask→chips→band→listings; add to prefers-reduced-motion). prefers-reduced-transparency opaque fallback for the hero glass card + .glass-nav. Finalize a11y (focus rings, aria). THEN Ship-1 completion check (pre Phase 5): typecheck + lint + drive home(idle+engaged)/porter/tabbar + existing-screen regression (inventory/listings/orders/more) in light+dark."
  amendments_from_2advisor_review:
    - "Chunk1 T1 token list AUGMENTED: added --on-forest #EEF6F5, --on-forest-mute #9FC9C8, --glass-control rgba(255,255,255,.10) + @theme --color-on-forest/-on-forest-mute."
    - "Dropped mock-only '+$420/week' delta (no data). Mic = wired (option A, reuse useVoiceInput). active badge added. value-band sibling structure. ActionPills/avatar teal override. Both advisors converged → high confidence."


