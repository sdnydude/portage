# Onboarding Expansion — Tutorial Hub + Screenshot Show-and-Tell

**Date:** 2026-07-14
**Status:** Approved (brainstorm + plan approved 2026-07-14)
**Sequencing:** Build starts only after the photo drag-reorder + 24-photo cap ship (feat/photo-reorder-24cap) completes. That ship stays active — this spec does not interrupt it.

## Context

Current onboarding is a 5-step first-run carousel (`apps/web/src/components/onboarding/onboarding-flow.tsx`) with static SVG icons + text, shown once (`user.onboardingCompleted`), never re-viewable. Goal: improve and expand it into show-and-tell instructions — real screenshots with animations and text — covering setup, adding items, listings, inventory, orders, the settings panel, and Porter AI chat.

## Approved design decisions

1. **Placement:** short first-run carousel (upgraded visuals) + full Tutorial hub under More/Help — re-viewable anytime.
2. **Media:** real app screenshots + animated overlays rendered in-app (highlight rings, tap ripples, callouts, swipe arrows). No GIF/video — lightweight PNG + CSS/JS, regenerable, text stays selectable.
3. **Topics (8):** Setup (eBay/Reverb connect, seller profile, billing) · Adding items (scan + manual) · Listings · Inventory · Orders · Settings tour · Porter AI (chat, 3 tools, action pills) · Messages. ("Reviews" in the original ask was the verb — review the settings panel — not a feature.)
4. **Pipeline:** scripted Playwright capture, checked in, rerunnable when UI changes — prevents silent screenshot rot.
5. **First-run carousel:** keep 5 steps + copy; swap SVG icons for device-framed screenshots + one subtle overlay animation each; final step gains secondary "Explore tutorials" button.

## Architecture

### A. Content model — `apps/web/src/lib/tutorials/`
- `types.ts`: `TutorialTopic { slug, title, description, steps: TutorialStep[] }`; `TutorialStep { id, title, body, screenshot, overlays: Overlay[] }`; `Overlay { type: 'highlight' | 'tap' | 'callout' | 'swipe', x, y, w?, h?, text?, delay? }` — coords as % of screenshot natural size.
- One module per topic (`setup.ts`, `adding-items.ts`, `listings.ts`, `inventory.ts`, `orders.ts`, `settings.ts`, `porter.ts`, `messages.ts`) + `index.ts` registry.
- Each module also exports its capture manifest (route, actions, capture points) consumed by the capture script — one source of truth so overlay coords and screenshots stay in sync.
- Static TS data; no DB or API changes.

### B. TutorialPlayer — `apps/web/src/components/tutorials/`
- `tutorial-player.tsx`: device-framed screenshot (rounded frame, notch), absolutely-positioned overlay layer animating on step enter via CSS keyframes (follow existing `globals.css` animation idiom). Step text below frame, next/prev buttons, progress dots (reuse dot pattern from onboarding-flow.tsx).
- Missing screenshot asset → neutral placeholder frame, no crash.
- Overlay animations: highlight = pulsing ring; tap = ripple; callout = bubble slide-in; swipe = animated arrow.
- Respect `prefers-reduced-motion`.

### C. Tutorial hub routes
- `apps/web/src/app/tutorials/page.tsx` — topic grid (8 cards: icon, title, description, step count). Outside `(tabs)/`, PageHeader with back nav (same pattern as settings pages).
- `apps/web/src/app/tutorials/[topic]/page.tsx` — renders TutorialPlayer for the topic; unknown slug → notFound().
- Entry points: More tab item, settings/help page link, onboarding final step, "Replay intro" link inside hub (re-shows OnboardingFlow without touching the completed flag).

### D. Screenshot capture pipeline
- `scripts/capture-tutorials.ts`: Playwright script that
  1. mints a demo-account internal JWT via the API (demo credentials from Doppler/.env),
  2. injects `portage_token`/`portage_user` into localStorage,
  3. seeds demo items/listings/orders via API if missing (idempotent),
  4. iterates topic capture manifests: navigate route at 390×844 viewport, perform defined actions, `page.screenshot()` at capture points,
  5. writes `apps/web/public/tutorials/<topic>/<step>.png`.
- npm script `npm run capture:tutorials`; NOT in CI (needs running app). Rerun-on-UI-change documented in apps/web/CLAUDE.md.

### E. First-run carousel upgrade — `onboarding-flow.tsx`
- Replace icon block with small device-framed screenshot + one overlay animation per step (reuse TutorialPlayer frame/overlay primitives at reduced size).
- Final step: primary "Start Scanning" + secondary "Explore tutorials" → `/tutorials`.
- Keep 5-step structure, copy, skip/back/next, slide animation, completion flow.

## Error handling

- Missing/failed screenshot load: placeholder frame, tutorial still navigable.
- Unknown topic slug: Next.js `notFound()`.
- Content integrity enforced by TS types + schema-validation tests (no runtime validation needed for static data).

## Testing (Vitest, apps/web)

- Content schema validation across all 8 topic modules (coords in 0–100, screenshot paths under /tutorials/, unique step ids).
- TutorialPlayer: step nav, overlay rendering, placeholder fallback, reduced-motion.
- Hub page render + unknown-topic 404.
- Updated onboarding-flow tests (new secondary button, screenshot block).
- Capture script excluded from CI.

## Verification (Definition of Done)

1. `npm run capture:tutorials` against running app → 8 topic folders populated with real screenshots.
2. `npm run typecheck && npm run lint && npm run test -w apps/web` green.
3. Run the app, walk `/tutorials` at mobile viewport: all 8 topics play, overlays land on correct UI elements, back nav works, all entry points navigate correctly.
4. Fresh user (onboardingCompleted=false): carousel shows screenshots + animations, "Explore tutorials" lands in hub. Screenshot proof required.
