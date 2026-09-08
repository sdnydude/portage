# Portage batch: Porter, inventory UI, header, listing content, eBay sync gaps — spec (2026-09-06)

Operator requests from the 2026-09-05/06 sessions, in the operator's words where
they were given, plus the evidence gathered. This is the source the plan argues
from. Nothing here is built until the plan is reviewed, verified, revised, and
the operator says go.

## A. Porter

- "Porter is currently useless. I ask it to lookup sennal 148-xu and it tells me
  there is no item in portage. I ask it anything about portage and it knows
  nothing. Let's make Gemini 3.8 Flash the model for Porter."
- Evidence: `search_inventory` matches the whole query as one substring of
  `items.title` only (`apps/api/src/routes/porter.ts`, `ilike(items.title, '%q%')`).
  No item in the inventory contains "148"; a typo'd or hyphenated query cannot
  hit. The grounding validator discarded a correct reply today because a title
  beginning "NEW, never Used, Marshall…" split to the bare name "NEW"
  (`apps/api/src/lib/porter-grounding.ts`). `PORTER_SYSTEM` has no facts about
  the app itself. Live chain: `CHAT_PROVIDERS=local:granite4.1:8b,gemini`.
- Requirements: word-level search across title, brand, model, description
  (every word must match; hyphens split); grounding accepts a whole entry line
  that contains a returned title; a concise "About Portage" facts block in the
  system prompt (operator reviews wording before deploy); chat chain
  `gemini:gemini-3.8-flash,gemini:gemini-2.5-flash` in Doppler dev + prd;
  optional typo tolerance via `pg_trgm` (extension available, not installed —
  operator decision, it is a DB change).

## B. Inventory pagination

- "On the inventory page you can't see all 200 items we must add pagination,
  with user selectable 25, 50, 100 per page dropdown menu."
- Evidence: `GET /items` accepts `limit` (1–100, default 50) and `offset` and
  returns `total`; `useItems` accepts both; the inventory page passes neither
  and renders no pager (201 items, 50 shown).
- Requirements: page-size select (25 / 50 / 100, default 50), previous/next,
  "N–M of total", page resets to 1 when search/category/status changes, works
  on the mobile list and the desktop workbench list pane; selection/bulk bar
  operate on the current page.

## C. Tag colors in light mode

- "The colors used for tags works on dark mode, but are unreadable in light
  mode. Fix them."
- Evidence: status chips use `--chip-*` tokens defined for `:root` (light) and
  `:root.dark`; condition pills use Tailwind `bg-emerald-100 text-emerald-700
  dark:…`; filter chips use `bg-muted text-text-secondary`. The offending
  surface is not yet identified. Requirement: screenshot the inventory list,
  item detail, and scan review in light and dark on the e2e stack, identify
  every tag with contrast below 4.5:1 in light mode, fix the tokens/classes,
  re-screenshot, send both to the operator.

## D. Header

- "The header must always have the user menu, light and dark mode toggle."
- Evidence: mobile `PageHeader` renders the avatar only when `showAvatar` is
  passed and never the theme toggle; desktop `TopBar` has the toggle; 13
  screens draw their own `<header>` (item detail ×2, edit ×2, scan review,
  messages thread, order detail, preview, tutorials ×2, settings ×4, Porter
  tab) with a back button and no avatar or toggle.
- Requirement: one `HeaderActions` cluster (theme toggle + avatar/user menu
  link to /more with unread dot) rendered on every header, mobile and desktop,
  including the custom ones; the scan sheet keeps its close/back button and
  gains the cluster.

## E. Description box caret (iOS)

- "When I edit in the description box, the cursor is active elsewhere even
  though I can see it and move it."
- Evidence: `AutoGrowTextarea` resets `height:auto` and re-measures on every
  value change while focused; iOS Safari is known to desync the drawn caret
  from the insertion point when a focused textarea's height changes.
- Requirement: grow only when content needs a new line, never reset height
  while focused, shrink on blur; operator device retest after deploy.

## F. Multi-value item specifics in the UI

- "Choosing multiple aspect item in one section is not working."
- Evidence: prefill now returns MULTI-cardinality aspects with several values
  (Features ×13 on AirPods); the web keeps `Record<string, string>` in
  `useScanAspects` and single-select chips in `ScanAspectsSection` and
  `AspectFillSheet`; `GET /marketplace/ebay/category-aspects/:id` already
  returns `cardinality` per aspect.
- Requirement: aspect state is `Record<string, string[]>`; MULTI aspects render
  toggle chips (tap adds/removes, count shown), SINGLE aspects keep
  single-select; prefilled multi-values show as selected; save/publish send
  arrays; the same on the edit page if it edits aspects.

## G. Listing content

- "Never write I am selling in any condition or description." Done in the
  worktree (prompt ban + test), not deployed.
- Template: "structuring a listing template without discussion is never your
  call." The shipped section template (Overview / Condition / Function /
  Included / Specs) is live and must be replaced by whatever the operator
  approves after reviewing `docs/research/2026-09-06-ebay-description-best-practices.md`
  section 7. Open questions there: labelled sections vs paragraphs; bullets vs
  prose for specs; length band; seeding the model with the operator's own past
  descriptions as style examples; Function as its own section or inside
  Condition.
- Epson 5050UB listing on eBay still shows the pre-fix description (no footer,
  no line breaks) until its next revise; one revise fixes it (operator go).

## H. eBay sync audit gaps (from the 2026-09-06 truth table)

1. "Title too long." is not a terminal sync failure: 5 retries ≈ 15 min of
   "Syncing…"; Portage allows 500 chars, eBay 80. Requirement: warn at item
   save when title > 80 and an active eBay listing exists; make the eBay error
   terminal in the worker.
2. The edit page navigates back before the sync job runs and ignores
   `syncQueued`, so the seller never sees Syncing / Synced / Failed there.
   Requirement: after a save that queued syncs, land on the item detail page
   (which has the badge) instead of `router.back()`.
3. Every Portage revise overwrites eBay-side Return Policy (`ReturnsNotAccepted`),
   `ListingDuration` (GTC) and `DispatchTimeMax` (1 day unless handlingDays).
   Requirement: seller-profile settings `ebayReturnsAccepted` (bool),
   `ebayReturnDays` (14 | 30 | 60), `ebayHandlingDays` (1–5), surfaced in
   Settings → Seller profile, applied by the Trading builder on Add and Revise.
5. Listing-row shadowing: a listing row's own `aspects`, `categoryId`, or
   `conditionDescription` win over item edits (2 of 30 rows carry `aspects`).
   Requirement: item wins — an item PATCH that changes aspects, category, or
   condition notes clears the corresponding key from the listing row's
   `marketplaceSpecificFields` before the sync job runs.
6. Portage's GetItem never requests `Description`. Requirement:
   `buildGetItemXml` sends `<DetailLevel>ItemReturnDescription</DetailLevel>`
   and `EbayItemDetail` gains `description: string | null`.

## Decisions (operator, 2026-09-06 21:36 ET)

- Template: APPROVED as proposed in the research report §7 — sections Overview /
  Condition / Function / Included / Specs, seller first person, no announcing
  openers. "Use it to sell professionally and quickly."
- Length: NO minimum word count. "Don't feel compelled to make a description a
  minimum number of words. If you do you will produce slop. Write descriptions
  that fully inform buyers, point out key features, list specifications, and
  provide useful summary description." The prompt states the goal (fully
  inform: key features, specifications, useful summary) and an upper bound
  only.
- Plan review: the operator's defined 4-advisor review runs on the plan before
  execution; findings are folded into a revised plan; then the operator says go.

## Global constraints

- TDD one test per edit under tdd-guard (rule `tdd-one-test-per-write.md`).
- Git writes need per-action operator approval; `gh pr create` is exempt.
- Proof before push for any `.tsx` change: screenshots under
  `apps/web/test-results/proof/` newer than the change, verified by eye and
  sent via SendUserFile; waivers are the operator's alone.
- No deferrals without per-item approval; findings are fixed or approved.
- Live stack: `docker compose -p portage --project-directory /home/swebber64/DHG/portage`
  with build contexts pointed at the checkout being deployed; API boots on
  the Doppler `dev` config synced to `.env`.
- Worktree builds: tdd-guard's validator reads
  `<main checkout>/.claude/tdd-guard/data/test.json`; a worktree's vitest must
  run with a local config whose reporter `projectRoot` is the main checkout
  (`apps/api/vitest.guard.config.ts`, `apps/web/vitest.guard.config.ts`, both
  untracked). Two lanes running tests concurrently overwrite each other's
  `test.json` and get false validator rejections. Parallel lanes therefore
  either (a) serialize test runs with a lock, (b) run as separate operator-
  launched sessions rooted in their worktrees, or (c) run under an
  operator-approved scoped tdd-guard bypass. Operator decision in Phase 0.
