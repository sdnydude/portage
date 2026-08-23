# 2026-08-22 — Deferral P3: beta UX truth

**Span:** 2026-08-22 12:18 → 22:20 ET · **Branch:** `feat/p3-beta-ux-truth` · **PRs:** #315 (merged `734ae42`), #316 (docs)

## The story

P3 was the first deferral phase with a fully pre-written plan (08-15) — nine
registry items, each with what/not/acceptance/edge. The session ran it as a
`/ship`: Phase 2 explorers, a 4-advisor plan review, a 13-task build under
tdd-guard, three per-chunk diff reviews, a 6-agent final review, deterministic
Playwright proofs on rebuilt containers, and a live repro on a real eBay
listing.

The advisor round changed the plan in two load-bearing ways. The backend
advisor proved the adapter's fast-path throw site is dead from current callers
and has no threshold data, while the spec advisor showed that "same payload as
the pre-flight" requires the live GetItem heal — the resolution was to attach
details at all three adapter sites and let the route's post-save catch do the
heal + persist + 422 rethrow. The frontend advisor caught that the plan's
"aspectsBlockPublish unchanged" would have left Save & List enabled during an
aspect-schema outage — the exact lie the item existed to fix.

The build was clean until the first live e2e screenshot. Two defects had passed
every unit test: JSX swallowing the space in "Good isn't" (jsdom normalizes
whitespace), and the "Complete" badge — which a Phase 2 explorer had grepped
for and declared nonexistent — sitting in a child component claiming
completion during the outage. Both fixed; the badge clause was nearly dropped
from the spec on a false negative.

The Phase 6 review found one genuine critical the chunk reviews missed: the
generalized conflict handler opened the price editor with whatever
`editedPrice` happened to hold, so "Adjust to fit price" from a shipping save
would have computed thresholds against a stale number. It also found a
dead-end in Hybrid ("Tap Looks right to try again" pointed at an unmounted
pill) — Retry affordances were added to both flows.

T12's live repro was initially handed to the operator; corrected ("you do 1
and capture proof"), then driven with an `E2E_EBAY_LIVE`-gated spec on the
NETGEAR GSM4212P listing: conflict → banner with eBay's numbers → Adjust →
revise synced → price restored in-run, thresholds restored after. The
post-save path couldn't be induced live (no listing carries thresholds Portage
doesn't store); route tests cover it.

CI caught one regression on the first push: the legacy `proof-best-offer.spec`
text matcher now hit two elements (server sentence + banner line). Scoped to
the banner; all checks green; merged.

## Learnings
- Exploration conclusions about UI must be confirmed on a rendered screen before they change a plan — a grep-based "badge doesn't exist" nearly dropped a spec clause.
- jsdom text matchers normalize whitespace; mixed `{expr} text` JSX needs a template literal and an exact-string e2e assertion.
- A generalized error handler that opens a form must seed that form's inputs — reuse of a handler across entry points silently breaks the invariant the original entry point held.
- `test-results/` is wiped per Playwright run: copy proof PNGs out immediately, or a second run (even a failing one) erases them.
- `fullPage` screenshots of a modal capture the page beneath; use viewport shots with `scrollIntoViewIfNeeded` on the target.

## Insights
- Live e2e screenshots are the only gate that catches whitespace and "component I didn't know existed" classes — eyeball at least one PNG per surface before calling it done (captured a0814223).
- Playwright's `-w` is watch mode, not workspace — `npx vitest run -w` hangs forever.

## Deferred
None. Nine registry items resolved; zero new deferrals.

## Numbers
api 1011 → 1016 · web 649 → 674 · e2e +6 · 24 code files · 2 code commits + 1 e2e fix + 1 docs commit · ~40 review findings fixed · 14 proof PNGs.

## Addendum (22:16 → 00:25 ET)

- **Docs pass (PR #316, `81648a5`):** 9 stale pages corrected after an
  18-file audit; P3 visual-guide appendix added as a native page plus a
  standalone `guide.html` under `static/img` (CI only copies that tree);
  deferral plan tracked and stamped. Found the docs site had **not deployed
  since 08-13** — a bare `<11B` in the 08-11 proof page broke MDX on every
  run. Fixed; deploy-docs green; dhg-docs needed a restart after a local
  build (bind-mount inode ghost).
- **agentlint:** local rules verified enforcing (probed deny/allow directly).
  AgentChute key was two ESC bytes since Jun 23; cloud is a paid private beta
  → disabled, queue purged, `doctor` clean.
- **Housekeeping batch 1 opened:** 10 operator items, facts gathered, 3 design
  decisions taken (price both directions; items.status manual for
  non-marketplace states; est-value hidden, columns kept), 11-task plan +
  per-item live-proof contract written. Branch created, zero code. Operator
  bar restated: "red green tests are not proof of done."
