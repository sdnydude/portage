---
title: "2026-08-22 — Deferral P3: beta UX truth"
description: "Proof-of-done bundle: live Best Offer guided fix on a real eBay listing, deterministic scan/price/mobile proofs against the rebuilt containers, gates"
---

# Proof of Done — Deferral P3: beta UX truth

Captured 2026-08-22 21:30–21:45 ET against `portage-api` + `portage-app`
rebuilt from `feat/p3-beta-ux-truth` @ `387411e`. Every image below is a
Playwright capture from `apps/web/e2e/p3-ux-truth.spec.ts` (deterministic,
network-boundary outages) or `apps/web/e2e/p3-bo-live.spec.ts` (real eBay,
`E2E_EBAY_LIVE=1`). Nothing is staged or mocked on the page itself.

## 1. Live — the 2026-08-05 blocked price-save, on a real listing

Listing: NETGEAR GSM4212P, eBay item `307139861284`, $599 with auto-accept
$579 / minimum $549. Price lowered to $560 → refused with the real numbers and
two one-tap fixes. "Adjust to fit price" rewrote the thresholds under $560 and
the save went through to eBay (`marketplace_sync_log` success, 1.95 s). Price
restored to $599 in-run; thresholds restored to $579/$549 afterwards
(revise success, 2.7 s). The listing ended exactly as it started.

![Price editor before](/img/verification/p3-ux-truth/L1-live-price-editor-before.png)
![Live conflict — guided banner](/img/verification/p3-ux-truth/L2-live-bo-conflict-banner.png)
![Adjusted to fit](/img/verification/p3-ux-truth/L3-live-adjusted-to-fit.png)
![Saved after fix](/img/verification/p3-ux-truth/L4-live-saved-after-fix.png)
![Price restored](/img/verification/p3-ux-truth/L5-live-price-restored.png)

Not reproducible live: the **post-save** conflict path (eBay holds thresholds
Portage never stored). A second listing with offers on and no stored thresholds
(iPad folio, `307140951322`) accepted a lower price outright — no live
thresholds exist on it. That path is covered by two route tests (live heal →
`healed:true` + persisted; no read-back → stored values, no heal write). Price
restored to $64.

## 2. Deterministic — scan review tells the truth

![Comps outage + condition snap](/img/verification/p3-ux-truth/1-scan-review-outages-told.png)
![Category details outage — Unavailable, List blocked](/img/verification/p3-ux-truth/1b-scan-review-aspects-outage.png)
![After Retry](/img/verification/p3-ux-truth/2-aspects-retry-cleared.png)
![Category lookup failed](/img/verification/p3-ux-truth/3-category-lookup-failed.png)
![Genuine no-match after retry](/img/verification/p3-ux-truth/4-category-no-match-after-retry.png)

## 3. Deterministic — mobile deep link

![390px, ?item= — no pane, zero detail fetches](/img/verification/p3-ux-truth/5-mobile-deep-link-no-pane.png)

## 4. Deterministic — Best Offer guided fix (DB-seeded listing, no eBay)

![Guided banner](/img/verification/p3-ux-truth/6-bo-conflict-guided-banner.png)
![Adjusted to fit](/img/verification/p3-ux-truth/7-bo-adjusted-to-fit.png)
![Persisted after reload](/img/verification/p3-ux-truth/8-bo-fix-persisted-after-reload.png)

## 5. Gates

| Gate | Result |
|------|--------|
| `npm run test -w apps/api` | 1016 / 1016 (+5) |
| `npm run test -w apps/web` | 674 / 674 (+25) |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors (26 pre-existing warnings) |
| e2e `p3-ux-truth.spec.ts` | 5 / 5 on rebuilt containers |
| e2e `p3-bo-live.spec.ts` | 1 / 1 live (NETGEAR) |
| AgentShield | no findings from this feature |

## 6. Review ledger

4 plan advisors (25 findings → 12 amendments) · 3 per-chunk diff reviews ·
6-agent Phase 6 review. Two defects only the live e2e caught: JSX whitespace
("Goodisn't") and the real "Complete" badge (`ScanAspectsSection`) claiming
completion during an outage — now "Unavailable". Full ledger in
`.claude/review-records/a8eab4c8….md`.
