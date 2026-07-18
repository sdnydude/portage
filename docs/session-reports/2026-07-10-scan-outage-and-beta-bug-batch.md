# Session Report — 2026-07-09/10: Baked Images, Docs Overhaul, Scan Outage, Beta Bug Batch

**Session span:** 2026-07-09 evening → 2026-07-10 evening
**PRs shipped:** #189, #190, #191, #193, #194, #195, #196, #197, #198 (9 merged, all deployed, all live-verified)
**Test suites:** API 664 → 665 · Web 293 → 302 (all new tests written red-first)

---

## The Story

### Act 1 — Ending the bind-mount era (PR #189)

The session opened on a queued architecture decision: the previous day's outage
("plan defaults not saving") had exposed that `docker-compose.override.yml` was
auto-loading on every compose command, running portage-api as `tsx watch` over a
bind-mounted host tree. Image rebuilds were silent no-ops; a wedged file watcher
had served stale code for hours.

Stephen challenged the initial recommendation (keep dev-mode until launch) and
was right: a setup that is only safe when every future session remembers a
restart ritual is a setup that will fail again. The override file became
`docker-compose.dev.yml` — an explicit opt-in overlay — and the default stack now
runs the compiled prod image. The NODE_ENV development→production flip was
pre-verified against every branch in the code (CORS moot via same-origin
`/backend` rewrite; `CF_ACCESS_DEV_EMAIL` unset; `CF_ACCESS_AUD` present; certs
mounted). Deployed, and proven by round-tripping the exact admin flow that had
broken the day before.

### Act 2 — Documentation catches up with reality (PRs #190, #191, #193)

- **TODO.md truthfulness (PR #190):** Task 35 (integration testing) and Task 34
  (tunnel config) closed with evidence; the obsolete "Reverb OAuth code-grant"
  line deleted (PAT selling is live-proven); header recount 48/52 → 50/52.
- **Full docs sweep + screenshot appendix (PR #191):** three parallel agents
  audited 34 Docusaurus pages against the code. Biggest finds: docs still
  described password auth (CF Access shipped weeks prior), a carrier subsystem
  deleted in PR #142, and two facts wrong in CLAUDE.md itself — background
  removal is server-side rembg (zero `@imgly` imports), and vision is a
  provider chain with Gemini 2.5 primary. 117 stray screenshots moved from the
  repo root into a date-grouped gallery appendix.
- **Two live docs-site outages found and fixed en route:** (a) the dhg-docs
  nginx container was serving a deleted build-directory inode (Docusaurus
  rebuilds replace the directory; the bind mount kept the ghost) — restart
  re-resolves; (b) every doc image 404'd in production because assets deploy to
  `/portage/img/` while docs referenced `/img/` — one sed line in the deploy
  workflow fixed the class, and as a bonus webpack now bundles images at build
  time, converting silent runtime 404s into build failures.
- **Sitemap regeneration (PR #193):** diagrams updated to the real 35-route
  tree (CF Access gate card replaces Login/Register; `/beta/report` added). The
  generator's collision checker only guards wire/card crossings — a card/card
  overlap was caught only by rendering the PDF and *looking at it*.

### Act 3 — The scan outage: two bugs wearing one error (PRs #194, #195, #196)

Stephen reported "unknown error" on scan. The investigation found **two stacked
root causes behind one symptom**, plus a product decision:

1. **The 30-second proxy cliff (PR #194).** Next.js's rewrite proxy defaults to
   a 30s timeout. Every API call rides the `/backend` rewrite. Scans were
   legitimately running 30–40s (two sequential vision calls per refine, plus
   Gemini free-tier 503s forcing Anthropic fallback). The proxy killed
   connections at exactly 30.000s while the API finished successfully; the
   bodyless response became "Unknown error" via the client's JSON-parse
   fallback. Proven in an isolated scratch Next app: default config → HTTP 500
   at 30.007s; `proxyTimeout: 120s` → HTTP 200 at 45.008s. **Explicitly not**
   caused by the same-day container change — the aborting component was
   untouched by it, and old logs died with the recreated container.
2. **The schema that couldn't say null (PR #195).** Retesting after the timeout
   fix, scans failed again — in 20s, under the old cliff. New cause: Gemini
   returns `conditionNotes: null` when it has nothing to say; the Zod schema's
   `z.string().optional().default('')` tolerates only `undefined`. One null
   field 502'd an otherwise perfect response. Fixed with
   `nullish().transform(v => v ?? '')`; the live retest then sailed through to
   a full Review screen (95% AI match, comps bands) — screenshot-proven.
3. **The timeout as product tripwire (PR #196).** Stephen overruled the 120s
   timeout: users abandon after 20–30s, so a request that needs longer is
   already failed UX — fix latency at the source, don't absorb it. Reverted to
   30s, but written *explicitly* in config with the rationale and pinned by a
   "do not raise" test, so the decision is visible instead of being an
   invisible default. Known intentional consequence: Anthropic-fallback
   multi-image scans (~38s) error at the cap — pressure on fallback latency.

Gemini billing (added mid-session by Stephen) removed the 503 cascades: 4–12s
scans became the norm and made the whole class survivable.

### Act 4 — The beta bug batch: five bugs, evidence-first (PRs #197, #198)

Five bugs reported from real beta usage. Three read-only investigation agents +
API-log forensics ran in parallel before any fix:

1. **"Photos were not saved" (camera):** six upload call sites used raw `fetch`
   with a closure token and **no 401 recovery**. The internal JWT lives 15
   minutes; time in the native camera crossed expiry → `jwt expired` 401s in
   the logs at the exact reported times. Fix: `apiUpload()` with the same
   401 → re-exchange → retry contract as `api()`; all six sites migrated —
   class-level fix, not spot patch.
2. **"Something is missing — photos" on relist:** the publish guard validated
   flow-local photo state seeded *before* the item's photos had persisted
   (they'd been failing on bug #1!). The server publishes from `items.photos`
   regardless. The guard now re-checks the server item before refusing.
3. **Beta pill covering the camera's Done button:** pill and camera overlay
   were both `z-[70]`; the pill, as the later DOM sibling, won the paint order.
   Dropped to `z-40` — every full-screen overlay now covers it; position
   unchanged on normal pages.
4. **Login triple-fault:** (a) cold loads without a cached token rendered the
   logged-out hero while the CF exchange was still in flight — the provider now
   holds the spinner until the exchange settles; (b) "Get Started" was
   `<Link href="/">` — an SPA hop into a redirect loop that never reached the
   Cloudflare edge, so it could never start a login — replaced by an extracted
   `LoggedOutHero` with a plain full-document anchor; (c) CF returns users to
   the originally-requested URL, and stale `/login`/`/register` entries 404'd —
   permanent redirects added (live-verified 308s). The PWA manifest and service
   worker were checked and ruled out first.
5. **Duplicate empty weight/dims fields (PR #198):** eBay's own category
   aspects for PC Laptops include optional `Item Weight/Height/Length/Width` —
   live-verified via authed API call (32 aspects). The aspects UI rendered all
   of them, duplicating the dedicated AI-filled fields as empty twins. Fixed at
   the single fetch choke point (`useRequiredAspects`); live-proven post-deploy
   (expander count 29 → 25, DOM sweep zero physical labels, real aspects
   intact).

---

## Learnings

1. **One symptom, N causes — retest after every fix.** "Unknown error" hid two
   unrelated bugs (proxy timeout, schema null). Declaring victory after the
   first fix would have shipped a still-broken scan. The retest that "should
   have passed" is what found bug two.
2. **Timeouts are product decisions, not infra knobs.** The 120s fix was
   mechanically correct and product-wrong. A tight timeout is a tripwire that
   forces latency work; a long one silently absorbs failures. Encode such
   decisions as explicit config + a pinned test with the rationale in the
   comment, so no future session "fixes" it back.
3. **Rituals lose to structure.** The bind-mount setup was safe only while
   everyone remembered "restart, don't rebuild." Baked images made the correct
   behavior the default behavior. Same pattern as the timeout: make the right
   thing structural.
4. **Fix the class, not the instance.** One 401-dying upload call site was the
   report; six existed. One nullable field 502'd; the schema family had more
   (a follow-up hardening pass is still open). Grep for siblings before
   declaring a bug fixed.
5. **Errors that echo queries breed false diagnoses.** A Drizzle error printing
   the failed query's column list was misread as "column dropped from schema"
   — the real cause was the documented host-vs-container DB address gotcha.
   Verify a diagnosis against schema/DB/docs before repeating it. (Logged as a
   correction; second tool-order correction this session — CodeGraph CLI works
   via Bash without any MCP server.)
6. **Visual verification catches what checkers can't.** The sitemap generator's
   collision checker passed while two cards overlapped — only rendering the
   PDF and looking revealed it. The scan-fix proof, the badge fix proof, and
   the aspects fix proof were all screenshots of the running app, per the
   Definition-of-Done rule.
7. **Automation browsers have their own auth.** The Claude-driven Chrome needed
   its own CF Access session — Stephen logging in on his phone did nothing for
   it. Cost three round-trips; now known.
8. **Docusaurus absolute image paths are only build-verified when they
   resolve.** Unresolvable `/img/...` refs are emitted as literal URLs that
   404 silently in production; resolvable ones are webpack-bundled and fail the
   build if missing. The deploy-workflow rewrite converted the failure mode
   from silent-in-prod to loud-at-build.
9. **Module mocks must evolve with modules.** Adding `apiUpload` to `api.ts`
   broke 26 tests whose `vi.mock("@/lib/api")` stubs didn't define it —
   components got `undefined` and crashed inside tests. When extending a
   mocked module, sweep its test-side mocks in the same change.
10. **Two secrets incidents to not repeat:** an `export $(grep ...)`` misfire
    with an empty match dumped the environment (Resend key now needs rotation),
    and inline-credential curl was correctly blocked by hooks — header files
    via process substitution are the pattern.

## Insights

- **The stacked-latent-bug pattern:** the 30s proxy cliff existed since the CF
  Access migration; the null-intolerant schema since May 9. Neither fired until
  Gemini's free-tier throttling slowed scans past 30s and a synthetic image
  provoked a null. Environmental shifts (quota, provider behavior) are bug
  *triggers*, not bug *causes* — git-blame the mechanism before blaming the
  day's deploy.
- **Single choke points make cheap class-fixes:** `apiUpload` (all multipart),
  `useRequiredAspects` (all aspect consumers), the deploy-workflow sed (all doc
  images). When a fix can live where all callers already converge, the
  regression surface is one test.
- **Client guards must validate the server's truth.** The publish photo-guard
  checked UI state while the server published from the DB. Any client-side
  precondition that duplicates a server-side source of truth will eventually
  disagree with it; check the authority or don't check at all.

## Deferred / Open

- Rotate the leaked Resend API key (Stephen).
- Schema-wide null-tolerance pass on the remaining vision output fields
  (`features`, `suggestedTags`, `aspects`, `weight`, `dimensions`) — same class
  as PR #195; also the `aspect-prefill` warning seen for `ebay.dimensions`.
- Friendlier copy for the 30s timeout error (currently "Unknown error").
- Latency pass on the two-call refine + Anthropic fallback path (intentionally
  pressured by the 30s cap).
- Registry deferred backlog trio (self-heal-block unwind, usePhotoEdit
  refactor, updateListing warning contract).

---

*Report generated at session end, 2026-07-10. Source of truth for PR details:
git history #189–#198; registry captures: 8 bug fixes, 6+ ship sessions,
4 insights, 3 corrections, 4 test-coverage events this span.*
