# Session Report — UNLISTED badge fix, listing-hub merge plan, CI auto-review

**Span:** 2026-07-11 morning → afternoon
**PRs:** #202 (merged), #203 (merged)

## The story

The session opened on the handoff's task #1: every inventory item badged UNLISTED despite active marketplace listings. The diagnosis loop went DB-first: the listings row for the evidence item (ASUS c19d41df, eBay 307054605978) was `active`, and the hand-written SQL for the badge subquery returned true — yet the live API returned `listed:false` for all 12 items. Drizzle's `toSQL()` exposed the cause: on single-table selects drizzle strips table qualifiers, so the interpolated `${items.id}` inside the `exists` subquery rendered as bare `"id"`, which Postgres resolved to `listings.id` in subquery scope. The correlation was `listings.item_id = listings.id` — always false, no error, invisible to the route tests because they mock the db entirely. Fix (PR #202): exported `itemListedExpr` with the outer reference forced via `sql.raw('"items"."id"')`, plus a regression test that renders the query through `drizzle.mock()` and asserts the qualified correlation in generated SQL — the only seam that can catch this bug class. Deployed and live-verified: 12/12 `listed:true`, badge gone in the browser.

The middle of the session was design work: Stephen asked whether the listing detail page could merge into item detail for one page format. Audit showed the two pages had zero cross-navigation, heavy duplicated UI, and a dishonest edit surface (listing-page title edits silently PATCHed the shared item). The answer became a 5-task plan (`docs/superpowers/plans/2026-07-11-listing-hub-merge.md`): inventory/[id] absorbs listings as ListingCard components, listings/[id] becomes a redirect, plus an owner-requested `/inventory/[id]/preview` share page with client-side PNG generation (html-to-image + Web Share API). The plan then survived four review rounds — field-parity audit, drop audit, two-agent advisor review, and an attack-mandated adversarial review (10 verified attacks folded, 9 refuted) — each round producing concrete plan amendments rather than new code.

The session closed with infrastructure: `.github/workflows/claude-review.yml` (PR #203) wires anthropics/claude-code-action@v1 to review every PR — deterministic enforcement replacing session-dependent review discipline. The first run self-skipped by design ("workflow validation skip": the action refuses workflow definitions not yet on the default branch, an anti-prompt-injection guard), so the live cost test lands on the next PR. ANTHROPIC_API_KEY and GEMINI_API_KEY were set in GitHub's encrypted secret store via container-env → file-redirect, values never displayed.

## Learnings

- Drizzle strips table qualifiers on single-table selects, including inside embedded sql`` fragments — correlated outer refs must be forced with sql.raw; mock-db route tests cannot catch generated-SQL bugs, drizzle.mock()+toSQL() is the seam.
- claude-code-action refuses to run workflow definitions that aren't on the default branch yet — a new review workflow can't test itself on its own PR; merge first, test on the next PR.
- gh secret set from a pipe can fall into interactive TTY mode; file-redirect stdin is unambiguous.
- graphify ≥0.9.2 changed CLI: `graphify update <path>` subcommand (no LLM for code re-extraction); old `--update` flag errors.
- An adversarial review needs no human adversary: fresh agent + attack mandate + burden of code-level verification on every claim; 10/19 attacks survived, including a scroll-effect re-yank bug that green tests would have shipped.

## Insights

- The plan-review stack (parity audit → drop audit → advisor → adversarial) found ~25 issues at plan-time for the cost of text edits; none were design-level rejections — the value was concentrated in build blockers (Suspense, test mocks), unowned surfaces (4 Playwright specs), and 2 logic traps (scroll re-yank, deploy-order window).
- PATCH /items already best-effort revises all active eBay listings (items.ts:506-555) — the merge's removal of listing-surface title editing is not a propagation regression; Reverb is the gap (captured as deferred item).

## Deferred

- Reverb listings don't sync on item edit — extend the items.ts revise loop to Reverb rows (TODO.md Phase 7 + registry deferred item).
- Required-status-check enforcement for the Claude review workflow — decide after measuring per-review token cost on the next PR.
- CodeRabbit + Claude review now overlap on every PR — decide whether both stay.
- apps/api/CLAUDE.md test count stale (665 → actual 666).

## Behavioral corrections (captured to registry)

- Don't re-ask approval mid-task after the task was authorized ("Why did you stop in auto?").
- Never present first-time practices as established precedent — /simplify had never appeared in any plan; it entered this one because Stephen suggested it ("I call bullshit" was correct).
