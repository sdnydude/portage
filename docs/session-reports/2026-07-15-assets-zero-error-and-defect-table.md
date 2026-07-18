# Assets, zero-error gate, and the defect table — 2026-07-15 (afternoon/evening)

Continuation of the morning session (R0 follow-ups #230, onboarding build #231/#228). This arc: tutorial visual quality, the asset export program, three rounds of Stephen escalation, and the process changes that came out of them.

## Shipped (all merged + deployed to :3002)

- **PR #232** — tutorial visual edit pass: fake notch removed, player fits 390×844, 4 parallel Sonnet overlay passes + orchestrator review of all 24 panels, `scripts/render-tutorial-steps.mjs` QA harness.
- **PR #233** — zero-error captures: all 24 redone mixed-account (Stephen's real account for adding-items/inventory/listings/porter — real items with real photos; demo for setup/settings/orders/messages — no street address, no beta tier, no buyer usernames). Beta FAB hidden during capture. DeviceFrame compact mode renders %-scaled highlights only; compact bezel slimmed. `docs/assets/` 29+29 with-copy/without-copy exports (3×, transparent). **Real production bug fixed**: general (itemless) buyer messages 400ed the thread view — conversation-key regex demanded digits while sync writes empty itemId.
- **PR #234** — tutorial player chevron arrows + swipe + keyboard nav replacing the dated full-width Back/Next buttons; interactive-tour spec committed.
- **PR #235** — home hero density: hero was consuming >50% of the viewport before content; now ends ~31%, value band + eBay Price Check above the fold (measured 443/844).

## The three escalation rounds (and what they taught)

1. **"In what world would you show test data?"** — I proposed shipping assets containing E2E-seed artifacts as an interim. Zero-error publication gate now permanent memory: no test data, no stray text, no wrong photos, no defect of ANY kind on external-facing material; never rationalize an interim publish.
2. **Live spot-check found "E2E Seed" text in production tutorials** — the deployed PNGs predated the data fix. Root: verifying in synthetic contexts (fresh browser, demo data, jsdom) and calling it done. Fix pattern now: real account, real data, my eyes on every panel, review hub for his.
3. **The defect table** — five artifacts still "a mess": overlay rings on glyphs/bisecting elements, bezel enormous at 3× asset scale, double-chrome bottoms, and (worst) a **stale sign-off drop** in the review hub exposing his marketplace usernames from a superseded capture round. Deliverable format that finally fit his workflow: **XLSX with photos embedded per row + a verdict column** (docs/qa/2026-07-15-panel-defect-table.xlsx). All fixes blocked pending his row-by-row verdicts.

## Infrastructure decisions

- **DHG Review Hub**: nginx `dhg-review` container on :8023 serving `/home/swebber64/DHG/review-drops/` + `~/.claude/scripts/review-drop.sh` publisher. Container RUNNING; publishing BLOCKED by permission classifier pending Stephen's explicit naming (exact sentence in the handoff below).
- **Permanent web dev server**: `portage-web-dev` service appended to docker-compose.dev.yml (node:20, :3005, repo bind-mount, `NODE_EXTRA_CA_CERTS` = the prod app's own cert trick). Start BLOCKED by the same classifier pending the same sentence. This kills the all-day throwaway-dev-server churn (three restarts, undici cert rejections, PWA/service-worker interference).
- **Interactive first-run tour**: spec locked (5-stop core loop / mandatory-with-exit / replaces carousel) at `docs/superpowers/specs/2026-07-15-interactive-tour-design.md`; build deliberately deferred to a fresh session.

## Learnings

- undici (Next dev rewrites) ignores `NODE_TLS_REJECT_UNAUTHORIZED`; the prod app trusts the self-signed API cert via `NODE_EXTRA_CA_CERTS=/app/certs/cert.pem` (SAN 10.0.0.251) — replicate that, never fight TLS per-process.
- Real-account captures instantly exposed what demo data hid: a production messages bug, buyer PII, the Beta FAB photobomb, and a genuine filter-row crowding defect at 390px.
- Review deliverables must match the reviewer's workflow: three formats failed (hub drop, HTML artifact, inline table + separate files) before XLSX-with-embedded-photos landed.
- Publishing "for sign-off" then continuing to change the underlying content is how a third round happens. Drop regeneration is now the mandatory last step of any render cycle.

## Insights

- The zero-error gate is binary and includes process: a stale review artifact is itself a defect, equal in severity to a pixel error.
- Mixed-account capture (real account for product richness, demo for account-state screens) is the reusable pattern for PII-safe marketing captures.

## Deferred / blocked (the pickup list)

1. **Stephen's row-by-row verdicts** on docs/qa/2026-07-15-panel-defect-table.xlsx — every geometry/chrome fix waits on this.
2. **One-sentence authorization**: "Approved: run portage-web-dev (docker, port 3005, LAN, repo bind-mount, persistent) and keep dhg-review nginx (port 8023, LAN, persistent)" — unblocks the dev server + hub publishing.
3. **Interactive tour build** (spec ready; fresh session; trigger: "build the tour").
4. Filter-row crowding app bug (chips truncated by count+toggles at 390px) — registry deferred item.
5. DHG Assets registry table + ingest/search pipeline (docs/TODO.md section; own project).
6. Orders/messages/porter-pills tutorial panels still show empty-state frames until demo account has staged data.
7. Stash entry `stephen-claude-md-2` in shared stash stack — Stephen to drop (classifier blocks me).
8. Stephen's `apps/web/CLAUDE.md` R0 doc updates remain uncommitted in his tree.
9. `graphify update` + memory sync at true session end.

## State at wrap

main = #235 merge; container :3002 runs it. Demo account: onboarding_completed=true, item copy realistic. No stray dev servers/APIs (audited + killed). Worktree `.claude/worktrees/onboarding` on docs/session-wrap-0715. Web 469 / api 688 tests green at last full run.
