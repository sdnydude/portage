# Deferral + TODO Audit — Independent Advisor Review (2026-08-05)

**Scope (operator-selected):** all open critical+high registry deferrals (3 critical + 42 high) + every Porter-core deferral regardless of priority (8) = **53 items full review**, plus full `docs/TODO.md` truth verification. Medium/low open items (129) indexed one-line in §5.

**Method:** 8 parallel read-only advisor agents; every verdict required file:line / merged-PR / live-check evidence; 5 already-done verdicts re-verified by hand in the main session (48432c5 select-mode fix, seller-profile.ts:122-125 removal note, api.ts breaker, globals.css:47 `--orb-core`, playwright.config.ts storageState — all confirmed). Evidence sources: repo at HEAD `e035b6d`, git/gh history, codegraph, graphify graph (rebuilt this session from HEAD: 5,496 nodes / 7,726 edges), live curls (Dependabot API, docs.digitalharmonyai.com, registry :8011).

**Proof standard (operator rule, restated 2026-08-05):** *"Already provable in code" is NOT proof of done.* Every row separates **Evidence gathered** (what this audit verified in code/git/live) from **Proof to close** (the executed command output, live check, or screenshot that must be produced before the row is closed). **No registry row was closed by this audit** — closures are listed as recommendations in §6 and each still requires its executed proof.

## Verdict ledger (53 reviewed)

| Verdict | Count | Meaning |
|---|---|---|
| still-deferred-and-needed | 21 | work verifiably absent from code; problem still real |
| already-done | 21 | shipped, evidence cited; row never closed — **registry ~40% stale on crit/high** |
| obsolete-superseded | 4 | superseded by decision/removal |
| needs-operator-decision | 6 | genuinely blocked on a named operator choice |
| unverifiable | 1 | permission-blocked from inside the session |

---

## §1 — docs/TODO.md verified state

| Item | Checkbox | Actual | Evidence | Correction |
|---|---|---|---|---|
| Phase 5: batch-enhance FE design re-validation | [ ] | not-done | API `POST /images/batch-enhance` exists (images.ts:156, commit 8f6ddb7) with **zero FE consumers** | none — see needs-decision c8e0e606 §3 |
| Phase 6: notification system | [ ] | not-done | only DB table (schema.ts:184) + prefs toggle page exist; no center, no push | none |
| Phase 6: dashboard trends + AI insights | [ ] | not-done | codegraph: zero Sparkline/trend symbols | none |
| Phase 6: enhanced-photo persistence | [ ] | **done** | item-detail.tsx:284-320 `handleSaveEditedPhoto` persists enhance/BG accepts via `updateItem({photos})`; rotate persists at :322 | **flip to [x]**; root CLAUDE.md "Remaining" line stale too. Proof to close: live edit→save→reload screenshot |
| Phase 6: reconcile externally-ended eBay listings | [ ] | not-done | zero reconcile symbols; only GTC sweep touches end lifecycle | none — same class as b6536cc1 §3 |
| Phase 7: pagination on listing/item hooks | [ ] | **partial** | hooks+API accept limit/offset since PR #42 (use-listings.ts:26-68, use-items.ts:52-94); **no page passes them** (inventory page.tsx:209, listings :133) | annotate: remaining work is UI wiring only |
| Phase 7: self-hosted runner hardening | [ ] | **partial** | no same-repo gate in any workflow; `e2e.yml:12,23` still runs pull_request on ALL PRs on self-hosted — real exposure; claude-review.yml now label-gated (partial); **deploy-docs.yml has NO pull_request trigger — TODO text stale** | annotate: narrow to e2e.yml (+optionally claude-review.yml) |
| R2 drag-drop ingest | [ ] | **done** | PR #252 (merge 93087e7, commit 7e26f23): drop-zone.tsx:19, desktop-ingest-panel.tsx, desktop-ingest.ts:78, use-desktop-ingest | **flip to [x]** |
| R3 Porter side dock | [ ] | **done** | same PR #252: porter-dock.tsx:15, context chip :124-131, mounted app-shell.tsx:6 | **flip to [x]** |
| R3 Porter conversation history UI | [ ] | **partial** | dock History view + resume shipped (porter-dock.tsx:99-121 over GET /porter/conversations); **missing: `/porter?c=<id>` deep-links + any mobile history** | annotate — operator decision a0eb2e98 §4 |
| R4 QR phone-camera handoff | [ ] | not-done | zero QR/handoff code or deps | none |
| Deferred: keyboard shortcuts | [ ] | not-done | zero hotkey/shortcut symbols | none |
| Deferred: hover row-actions/dense tables | [ ] | not-done | zero RowActions symbols | none |
| Sync P4: SKU reconcile + Sync-all | [ ] | not-done | zero reconcile/syncAll symbols | none — operator-approved deferral 08-03, legitimately open |
| Sync P4: per-field settings + global toggles | [ ] | not-done | zero autoSync symbols; sync-log page is log/retry only | none — approved 08-03 |
| Sync P4: Reverb→Portage inventory pull | [ ] | not-done | routes/marketplace/ has auth only; no pull endpoint | none — approved 08-03 |
| Sync P4: Reverb order sync + tracking push | [ ] | **partial** | order PULL is live code (orders.ts:174-175 + reverb-adapter.ts:408 getOrders); tracking PUSH absent (PATCH /orders/:id local-only, orders.ts:101,120) | annotate: narrow to "tracking push (+ order-sync verification)" |
| Sync P4: retire photo-save mutex after soak | [ ] | not-done | mutex active (item-detail.tsx:73,286,303-314) | none — correctly open pending soak |
| Sync P4: CLAUDE.md trio refresh | [ ] | **partial** | trio refresh on main (7453fca 08-01) already stale again; current 875/616 refresh exists only as **uncommitted working-tree edits** | annotate: closes only when trio lands on main |
| Sync gaps (unapproved): order decrement push | [ ] | not-done | zero decrement symbols | needs operator disposition (unapproved gap) |
| Sync gaps (unapproved): refund increment push | [ ] | not-done | no refund path in orders.ts | needs operator disposition (unapproved gap) |
| Sync audit M2: DeletedField live verification | [ ] | not-done | ebay-trading-builders.ts:414-415 unannotated; :247 says "live-verification pending" | none — correctly open, operator-gated live run |
| DHG Assets pipeline (5 items) | [ ] | not-done | no post-assets.sh anywhere; only reference is TODO.md itself; registry /api/assets EXISTS but empty (live GET: total 0) | none — see 440b667b §2-adjacent |
| Header: "48/49 ledger tasks" | n/a | holds | file-internal recount verified | none |
| Header: test-suite "687/687 · 526/526 (07-18)" | n/a | superseded | 875 API / 616 web as of 08-05 (working-tree CLAUDE.md) | update header + Last-updated |

---

## §2 — CRITICALS (3, all infra, all filed 06-21)

| Item | Verdict | What it is | Rationale (orig → assessment) | Blast radius | Risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|---|---|
| **Harden capture pipeline — landing-verified + idempotent** (7d218492) | **still-needed (narrowed)** | Registry capture scripts could silently drop posts; ask = verify each post landed in DB + safe re-send | "rewriting capture risks breaking all capture" → half-valid technical must-defer; aged — DLQ layer since shipped | A 2xx-but-wrong write or count-mismatch still loses knowledge silently; degrades briefings/pattern-detection built on this data | Moderate/moderate (was high/high pre-DLQ); non-idempotent inserts can double-post as retry paths grow | DONE since filing: capture-guarantee.py wired in Stop hook (settings.json:179-188); failed POSTs dead-letter to memreg-dlq.jsonl (memreg_capture.py:103-128,185-202); drain daemon live (docker Up 4wk). NOT done: verification is count-based not landing-verified (capture-guarantee.py:16,508-563); idempotency only on agent-sessions (409→PUT); DB constraints unverified (psql auth denied) | Run capture-guarantee against a transcript with a known-failed post → it detects the missing DB row by content-hash query; fire same capture twice → exactly one row (curl output); `\d` showing unique constraints on insights/decisions/corrections |
| **No GLOBAL capture backstop — most DHG apps capture NOTHING** (66096dd7) | **still-needed (half-built)** | Missed-capture sweep only wired for Portage; every other DHG project loses unlogged insights/decisions permanently | "multi-app infra change, needs project-agnostic rework" → valid (cwd-dependent script would misfire globally — still true in code) but half-finished for 6 weeks on a self-declared critical | All non-Portage projects (dhg-web active now): forgotten captures permanently lost; cross-project KB silently under-represents everything non-Portage | Certain + compounding; unrecoverable after the fact | session-capture.sh IS global with breadcrumb project resolution (~/.claude/settings.json Stop). capture-guarantee.py is portage-only; the dhg-memreg copy still resolves project via os.getcwd() (:96-97) — would fail under Stop hooks (PWD=/tmp) | Port breadcrumb resolution into dhg-memreg capture-guarantee.py, register globally; then run a NON-portage session, emit uncaptured ★ Insight, end session, show registry row landed with correct project_name (curl output) |
| **Proof-gate system (screenshot → docs/proof → proof_artifacts → Stop-gate)** (61bbbc14) | **still-needed** | Machine enforcement of the proof rule: every done task saves a screenshot, registry records it with a VERIFIED insert, Stop-hook blocks unproven "done" claims | "must be built right as a focused task or it joins the dead-unwired pile" → valid shape, but critical, filed after "6 months of the rule ignored," 6 more weeks passed | Backend/infra tasks can still be declared done with zero proof and no machine pushback; registry captures still exit-0 trust | High recurrence — 08-05 shipping hot-area memo shows "no proof screenshot" still biting | Does NOT exist: no docs/proof/, no post-proof script, /api/proof-artifacts → 404 (live curl), Stop hooks have no done-claim gate. What DID ship is narrower: proof-before-push.sh (UI-file pushes only), review-before-commit (08-05), git-gate, deferral-gate | Either build as specified — live GET /api/proof-artifacts 200 with a row whose insert was SELECT-confirmed, docs/proof/ populated, demo of a blocked unproven done-claim — or operator explicitly rules the 4-hook stack satisfies the 06-21 spec and re-scopes the row |

---

## §3 — HIGH (42), by category

### infra (6 remaining high; 3 criticals above)

| Item | Verdict | What it is | Rationale assessment | Blast radius / risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|---|
| docs.digitalharmonyai.com CF Access gate (c6f43445, 06-04) | **needs-operator-decision** | Docs site reads as "down" off-LAN because CF Access intercepts with a login page; decide PUBLIC vs GATED | Valid — blocked on operator choice + infra-change approval; defect is 2 months without the question being put | Off-LAN users (beta testers, phone) hit login wall; recurring false "docs down" alarms | Live curl 2026-08-06: HTTP 302 → cloudflareaccess.com login; tunnel origin intact (config-portage.yml → :8017); CF_API_TOKEN authority already in Doppler dhg-infra | PUBLIC: off-LAN curl returns 200 no-redirect (output captured). GATED: decision log row + allowed-identity login screenshot |
| Dead-end / unwired-artifact audit (bccbc90e, 06-21) | **still-needed** | Systematic wire-or-delete sweep of orphaned hooks/scripts/endpoints + recurring orphan detector | Valid explicit operator deferral ("NOT today") — but "later" is 6 weeks old and the pattern recurred since | Sessions reason about dead code as live; ~604 weakly-connected graph nodes are noise in every codebase query; Best Offer crisis showed cost of wrong system-model | This audit itself found fresh instances: /api/assets live with 0 rows + no caller; reap-orphan-sessions.sh referenced by nothing; batch-enhance endpoint consumer-less | Committed audit report enumerating every orphan marked WIRED or DELETED with sha; first recurring orphan-detector report showing zero new orphans |
| Claude Code session latency (43a7295a, 06-21) | **still-needed** | Measure per-hook cost of the hook/MCP stack, prune, prove with before/after numbers | Valid at filing (sequenced behind AI-specifics build) — that blocker merged 06-23; rationale stale 6 weeks | Operator time every session: 8+ synchronous subprocess spawns per Bash call, 2 registry curls per prompt — unmeasured, which is the complaint | Some named offenders incidentally fixed (enforce-frontend-e2e early-exit; 3 hooks moved to async PostToolUse; MCP schemas defer-loaded) but synchronous stack GREW: deferral-gate, git-gate, review-before-commit, agentlint on every Bash | Timing report: per-hook p50/p95 from a real session (hook-timings log), then post-prune re-measure under an agreed budget (e.g. <500ms p95 pre-Bash) |
| Deterministic Stop-hook auto-capture (183474c5, 06-30) | **already-done** | Mechanical end-of-session transcript sweep posting missed ★ Insights/decisions/corrections | Was valid; gap closed by building exactly what it asked | None remaining under this row; residual (landing-verify) tracked by 7d218492 — don't double-count | capture-guarantee.py implements all asks (regex :44, extraction :85-103, posts :569-577, extended to decisions/corrections/bug-fixes), wired settings.json:179-188, loud failures + DLQ | Executed run: `capture-guarantee.py --dry-run --session-id <recent>` output showing detected/posted counts + log lines; then close |
| DHG Assets table + ingest/search (440b667b, 07-15) | **still-needed** | Ingest docs/assets/** into registry with AI captions + vector/FTS search | Valid — operator named it its own project 07-15 | Asset library unsearchable while dhg-web program actively generates assets; live-but-empty endpoints are a textbook unwired artifact | Registry API scaffolding EXISTS (openapi: /api/assets[/bulk/search/{id}]) but **zero rows** (live GET total:0); no post-assets.sh anywhere; source dirs waiting | Executed ingest + live search curl returning captioned embedded rows total>0; post-assets.sh + autopost rule committed |
| Ship-log generator revival + backfill (2e2201ce, 07-17) | **still-needed** | Docs-site ship log stalled at entry 055 (June); revive generator, backfill, enforce | **Valid — explicit operator directive 07-17 (revival over retirement), the compliant deferral flow** | Public change history 2 months stale (~150 PRs missing); backfill grows linearly with delay | ship-log/ ends at 055 (last entry commit 1705096); no backfill/SOP commits; generator untouched since f959206; docs-audit memory confirms open | Generator runs clean twice (idempotent, output shown), entries through latest merged PR, enforcement hook/CI step demonstrated failing on a missing entry, Docusaurus build green |

### frontend (15)

| Item | Verdict | What it is | Rationale assessment | Blast radius / risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|---|
| Photo-first publish drops ebayPreparedFields (c3b3013c, 06-04) | **already-done** | Fallback chat-pill publish silently dropped AI-prepared eBay fields → broken live listings | Banned shape ("keeps Chunk 6 clean") — predates rule; fixed same-day-to-3-days | None today; failure class (undefined policy IDs) also eliminated by Trade-First | Commits 79213c7/d9f436c/6e99799 on main; hybrid-flow.tsx:494-496 + conversational-flow.tsx:772-775 pass fields; use-listing-flow.ts:561-570 self-heals | Executed: photo-first fallback-pill publish to eBay, confirm live listing carries prepared category/aspects (screenshot/GetItem output) |
| Batch-enhance FE design re-validation (c8e0e606, 06-10) | **needs-operator-decision** | Locked "enhance all" FE design went stale before build; endpoint shipped, FE never did | Valid correctness precaution then; two months of flow churn make the locked design unusable — build requires fresh design pass | Consumer-less endpoint on main violates full-stack wiring rule; per-photo enhance friction persists | Zero batch-enhance references in apps/web (codegraph + text walk); POST /images/batch-enhance orphaned (images.ts:156-160 + test) | Decide: (a) build → fresh design pass + working EnhanceAll screenshot wired to the endpoint; (b) drop → remove/park endpoint + test, close superseded |
| Photo-gallery redesign (8dcb4e58, 06-10) | **already-done** | Strip + full-screen editor overlay replacing inline editor | Accurate tracking-gap at filing; picked up as Stage 2.5 within days | None; e2e-covered, survived later photo-tool iterations | PR #108 (merge 7907997), commits ba6dc1d/caac04d; scan-flow.tsx:1063/:762; item-detail.tsx:543/:605; photo-edit-panel.tsx:86-91 cites the approved comp | Executed: open scan review live, tap photo → overlay opens (screenshot), or run photo-gallery e2e green (output) |
| PreviewCard/CompsWidget unreachable fresh-scan (724ea182, 06-10) | **already-done** | prepare() gated on an item id that didn't exist yet → widgets dead in chat flows | Banned shape ("outside Stage 2 scope"), predates rule; resolved via dedicated PR | None remaining | PR #153 (merge d04293f, ancestor-of-main confirmed); hybrid-flow.tsx:638-643,:798 + conversational-flow.tsx:661-666,:934 create item at confirm then prepare() | Executed: fresh hybrid scan → confirm → PreviewCard + CompsWidget render (screenshot) |
| Phase G Save & List drafts-only (d6a48d02, 06-22) | **already-done** | Save & List silently drafted; ask = user chooses live at publish behind terms gate | Valid — user-reported bug bundled into Phase F | None; silent paths stay draft-safe by design | PR #133 F1: scan-flow.tsx:130-134,:683; create-listing-sheet.tsx:72,:466-473,:262-264; scan-listing-payload.ts:29-34 draft fallback | Executed: scan → Save & List → sheet with Publish-now toggle → live publish → 3-prefixed ItemID (screenshot) |
| Phase F publish unification (63d1c928, 06-22) | **already-done** | One sheet, price+terms panels, 7-day version-scoped dismiss, honest result screen | Design-spec capture, built in full | Only loose end is /about dead link (own row below) | PR #133 (merge 5d22368); element-by-element verified (sheet :58-71; disclaimer-sheet :67-68,:154-164; disclaimer.ts:9-43; result :174-382; scan path :1480-1491) | Already live-proven by weeks of real publishes; close cites PR #133 + one fresh publish screenshot through the sheet |
| /about page for terms links (610ee575, 06-23) | **still-needed** | Suppressed-terms microcopy links to /about — page never built → 404 in live publish flow | Valid flagged dependency at ship; unactioned ~6 weeks — the failure flagging was meant to prevent | Consent/legal-exposure gap: terms must stay discoverable while suppressed; grows with beta publishes | create-listing-sheet.tsx:686-690 renders the link; no about/ route (ls); /legal/terms + /legal/privacy exist (87b58da) | Decision first (recommend retarget microcopy to /legal/terms — hours). Then executed: click-through from suppressed publish → 200 page with clauses, logged-in + logged-out screenshots |
| UNLISTED badges wrong (f6870faa, 07-11) | **already-done** | Badge ignored listings table → active items labeled UNLISTED | Valid — handoff-preservation capture, executed next day | None; badge join-driven | PR #202 (merge a9c4e65) + 72d69fa subquery fix; item-card.tsx:52,:86 render on server-computed `listed===false` | Executed: /inventory screenshot showing an actively-listed item without badge, or GET /items output with listed:true |
| R0 follow-up batch (e7a7abd2, 07-15) | **already-done** | 8 triaged R0 polish items with per-item operator verdicts | **Valid — the compliant per-item flow, executed next day** | Sole residue: operator-approved DEFER #2 (type="button" nit, page.tsx:148) — cosmetic | PR #230 (merge 1f79f5c), commit 4bc01b0 covers every DO + both pending verdicts; DEFER #2 verified still absent (as approved) | Close on PR #230 citation + one executed check of any DO item (e.g. focus-ring screenshot); DEFER #2 stays as the recorded approved remnant |
| Inventory select-mode tap navigates (694c85f6, 07-15) | **already-done** | Nested Link inside toggle button — tap navigated instead of toggling | Banned shape, predates rule; fixed in 2 days | None; duplicate of 334daef2 | Commit 48432c5 (cites the OTHER row's id); shared branch fixes both surfaces; **hand spot-checked this session** | Executed: mobile-viewport select-mode tap toggles without navigation (screenshot or e2e output); close both rows together |
| Workbench select-mode click navigates (334daef2, 07-16) | **already-done** | Same bug replicated into desktop pane | Banned shape, predates rule; fixed next day | None | 48432c5: item-card.tsx interactive prop (:10-15,:100-106), page.tsx:174-177 `interactive={false}` + tests (+9/+11); **hand spot-checked** | Same executed check as 694c85f6 |
| Tutorial/onboarding PNGs + sitemap SVGs 4-tab regen (2dcca6ef, 07-17) | **still-needed** | Tutorial screenshots + sitemaps still show removed 5-tab nav; listings.ts copy says "Listings tab" | Mixed: needs-running-app constraint genuine; still lacks per-item approval; 19 days | Every tutorial viewer taught navigation that doesn't exist — violates zero-defect published-assets rule during beta onboarding | tutorials/listings.ts:11 stale copy; last PNG capture 35159e7 (07-15) and SVG regen 54ac7e9 both pre-date PR #240 (4-tab, 07-17); nothing since | Executed: capture:tutorials against 4-tab build, coord check, copy fix, per-PNG visual inspection record, sitemap regen — inspection pass record + new mtimes diff |
| listing-card shipping editor drops localPickup (6454017d, 08-02) | **still-needed** | Card shipping editor forgets pickup: stored true renders off, flips discarded on save | **"fix not yet requested" is not a rationale — records absence of a decision; 3rd defect cycle of shipping hot area** | Sellers silently lose pickup on live listings or churn re-toggling; invisible until a buyer asks | handleOpenShipping (listing-card.tsx:156-167) never seeds localPickup; save payload (:177-188) omits it; toggle renders (shipping-fields-section.tsx:73-80, mounted :543); adapter/builder tests exist (cea6c31) but nothing pins THIS surface — why 08-05 e2e re-found it | Two-line fix + component test (stored true renders on, survives save round-trip) + live proof screenshot: card editor pickup ON after reopen on a live listing |
| Reverb category picker on listing-card publish (307ffa75, 08-05) | **still-needed** | Publishing an existing category-less Reverb draft 422s with no picker on that surface — dead end | Banned shape ("beyond emergency triage scope") — needs per-item approval or build | Blocks revenue publishes from the primary listing surface on a live selling marketplace; hard stop | ReverbCategorySection imported only by create-sheet + preview-card (the workaround surface); listing-card error handling (:269-289) branches on eBay codes only, REVERB_CATEGORY_REQUIRED falls to generic error; AspectFillSheet (:649-665) is the pattern to copy | Executed: publish category-less Reverb draft from card → cascade appears → successful publish (screenshots) + component test on the 422 code opening the picker |
| Price editors must surface BO thresholds (25afd214, 08-05) | **still-needed (partial)** | Hidden Best-Offer thresholds 422 price saves as apparent app breakage (2× live 08-05) | Banned shape ("beyond triage scope") — mitigated by live-incident context; needs approval or build | Any offers-enabled eBay listing + price drop below thresholds looks like an outage to the user | BO fields DO render seeded in card editor (listing-card.tsx:76-100,:452-489,:499 — BO-5 rebuild). Missing: conflict path — zero BEST_OFFER_CONFLICT hits in apps/web; catch (:140-141) shows raw message; seed reads local DB copy which was exactly what was stale in the incident | Web test: BEST_OFFER_CONFLICT ApiError opens/highlights offers fields with server-healed thresholds; live screenshot of guided-fix UI on a below-threshold price edit |

*(15th frontend high — R0-batch member 610ee575 counted under its own row above; category count reconciles at 15 with both 08-05 filings.)*

### marketplace (10)

| Item | Verdict | What it is | Rationale assessment | Blast radius / risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|---|
| AI-fill eBay specifics at scan (929ac05a, 06-06) | **already-done** | Scan-time category resolution + AI aspect prefill replacing publish-time picker | Valid epic capture; built over June, row never closed | None; audit noise only | PRs #104/#132/#147; schema.ts:84-87 aspects JSONB; aspect-prefill.ts; use-scan-aspects.ts; requiredAspectsCache ebay-adapter.ts:34 | Executed: scan shows AI aspect chips pre-publish (screenshot) + aspect-prefill tests green (output) |
| Package weight + dims capture (bce9afa3, 06-06) | **already-done** | Schema + UI + adapter wiring killing eBay 25020 on Calculated shipping | Valid at filing; built within 72h (PR #101) | None; battle-tested (weight-floor decision, PR #274 built on top) | schema.ts:96-105 columns; weight-dims-inputs.tsx; weight-fill-sheet.tsx; e2e weight-capture.spec.ts; commits f559abd/44307f0/498b4f7 | Executed: weight-capture e2e green (output) or live Calculated publish with no 25020 |
| Scan Save & List ignores ebayPublishMode (d1e9054e, 06-09) | **already-done** | Always-drafted regardless of seller live setting | Banned shape, predates rule; fixed in the port PR as stated | None; confirm-sheet design safer than the literal prescription | scan-flow.tsx:673-683 seeds publishNow from profile with draft-safe fallback; zero publishImmediately hardcodes | Executed: seller profile live-mode → scan → sheet shows publish-now pre-selected; flip to draft → seed flips (screenshots) |
| eBay auto-setup forces Portage policies (d3abc2cb, 06-17) | **obsolete-superseded** | Ask to let sellers pick their own Business Policies — whole subsystem later deleted | Banned shape but accidentally correct — building it would have been wasted | None; complaint structurally impossible now | PR #185 removed the routes (seller-profile.ts:122-125 — **hand spot-checked**); Trade-First opted OUT of Business Policies (PR #133, ebay-adapter.ts:439-440) | Executed: POST /seller-profile/ebay/auto-setup → 404 (curl output; also pinned by seller-profile.test.ts:146) |
| MPN blank + dup listings row (47a8ab40, 06-23) | **already-done** | MPN item-specific never populated; republish could duplicate DB rows | Root-cause capture, then built; survived Trading-API migration | Residual: MPN not displayed in Portage UI — cosmetic, refile low if wanted | ebay-adapter.ts:341 normalizeAspects MPN + :468-471 sentinel; insert-first idempotency 844fe62 + PR #180 | Executed: live post-fix listing shows MPN in item specifics (GetItem/Seller Hub screenshot) |
| eBay Marketplace Account Deletion endpoint (c683b4bc, 06-28) | **still-needed** | Mandatory-for-prod-keyset endpoint receiving deletion notices + purging user data (or formal exemption) | **Valid — legitimately blocked on operator-only dev-portal check; defect = the 5-min check unperformed for 38 days** | eBay can flag/deactivate non-compliant prod keysets → total eBay outage (publish/orders/messages) for the live selling account; highest severity-if-realized in the audit | No endpoint (routes ls, codegraph, git log all empty); Portage stores eBay tokens/messages/orders so the obligation is real unless portal shows exemption | Step 1 (operator): dev-portal screenshot showing exemption or configured endpoint. Step 2 if not exempt: challenge-echo endpoint passing eBay's portal test button + API test proving deletion event purges rows (outputs) |
| Guard POST /ebay/auto-setup (4e1723d2, 06-30) | **already-done** | Neutralize the policy-creating endpoint | Banned shape predating rule; containment argument factually correct; closed in 9 days | None — removed outright, exceeds the ask | PR #185 (merge 2573362); commits b7aec36/9d82e99/be9758e; 404 test seller-profile.test.ts:146 | Executed: seller-profile test run green including the 404 guard (output) |
| Scope beta requests: sync/tags/not-for-sale (e8dc2168, 07-27) | **still-needed** | Three beta asks needing a scoping session that hasn't happened | Banned shape but substantively defensible (needs product decisions); 9+ days without the session is the slippage | Beta feedback loop credibility; sync half is the sold-items-still-active class that bit live 08-05 | No tags/notForSale schema columns; pull-sync still manual-only; no scoping doc or PR | Closes with a DECISION: scoping output scheduling or explicitly rejecting each ask, reconciled with 98f9f383/b6536cc1 |
| Listing status reconciliation (b6536cc1, 08-05) | **still-needed** | Periodic marketplace-truth sweep so externally-ended listings don't sit stale-active | Banned shape; no technical must-defer; instance-vs-class exactly what "fix the CLASS" feedback warns about | Every externally-ended listing reproduces the 08-05 incident (Trading 291, opaque edit failures, wasted job retries); high recurrence | getListingStatus exists both adapters (ebay :850, reverb :390); only caller is the throwaway triage script; sync-worker.ts (read in full) has no status sweep | Sweep in worker + unit test (externally-ended row transitions off active) + executed live check: end a test listing on eBay, one sweep interval, Portage row + UI show ended (screenshots) |
| Backfill Reverb orders + order sync (98f9f383, 08-05) | **still-needed** | 6 Reverb sales have no order rows; revenue under-reports; no periodic order import | Banned shape; also overstates the gap — manual POST /orders/sync machinery (heal + backfill map) already exists | Orders/dashboard revenue skewed; 90-day getOrders window means delay pushes oldest sales toward unreachable | getOrders wired to manual endpoint (orders.ts:143-183, reverb :174-175, window :160); nothing periodic (index.ts:17 starts only edit-sync worker) | Executed: POST /orders/sync then SQL count ≥6 reverb orders matching the named listings (output); scheduled caller in code + test asserting the timer fires |

### api / auth / security / config / docs / testing (11)

| Item | Verdict | What it is | Rationale assessment | Blast radius / risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|---|
| Carrier API integration (5b5d1dfb, 06-11, api) | **obsolete-superseded** | Placeholder in-app label purchase — replaced by redirect-to-eBay decision; subsystem deleted | Valid operator decision, overtaken by a second one | None; only damage is the open/high row contradicting the decision log — resurrection risk | Commit d22945e deletion via PR #142; all affected files verified absent (ls) | Mark wont_fix/superseded citing PR #142 + decision; absence checks already executed this audit (ls output) |
| Gemini vision 400 no-body (1c0ae91e, 07-19, api) | **needs-operator-decision** | July-era silent Gemini→Claude fallback; phantom hypothesis: host-side .env quoting | Banned shape at filing; keeping it open without a 5-min re-test is the current defect | If live: cost + observability only. Evidence says NOT live → row is a zombie 'high' misdirecting triage (it shaped provider decisions for 17 days) | .env.broken.20260728 contains quoted GEMINI_API_KEY (count-only grep, no secret read); 08-05 outage was schema-invalid **200s** — incompatible with an active 400; PR #292 guards shipped | Operator-authorized: one authenticated POST /scan on prod + Langfuse trace showing provider=gemini, no fallback generation (trace screenshot) → close as obsolete with root cause noted |
| Transient failure logs user out + retry storm (87d5da5e, 07-27, auth) | **already-done** | Logout on one dropped request + 100+ exchange storm; breaker + wipe-only-on-401/403 shipped same day | Banned shape but moot — fixed in the very next PR | None in code; open row risks someone "re-fixing" and regressing the SessionLostError/breaker subtlety | PR #263 commit 9438ef9; api.ts breaker/backoff/single-flight/throttle verified (:40-48,:54-80,:89-102) — **hand spot-checked** | Executed: web suite breaker tests green (output; _resetExchangeBreakerForTests harness at :44) |
| localStorage → HttpOnly cookies (47a82384, 05-16, security) | **obsolete-superseded** | Refresh-token-theft threat — refresh tokens no longer exist (CF Access + 15m JWT) | Banned shape predating rule; CF migration deleted the problem | Residual (different item): 15m JWT still in localStorage — bounded XSS exposure; decide separately if worth closing pre-beta | PRs #168-172; api.ts:83-85 comment; no refreshToken symbol anywhere | Close citing PRs #168-172. Successor (if wanted): DevTools shows no portage_token, HttpOnly Set-Cookie, session survives hard reload (screenshots) |
| 5 Dependabot vulns 2-critical (de51fcdf, 06-05, security) | **obsolete-superseded — successor work found** | June banner alert set no longer exists; **live check found 12 OPEN alerts today: 3 high (fast-uri #62, ip-address #61, undici #55) + 9 medium** | Operator personally parked pending go-ahead — legitimate | Successor reality: 3 high-severity deps on the default branch of a revenue-handling app | Live `gh api` calls executed this audit: zero critical alerts ever recorded; PR #257 superseded the era; current open list enumerated | Close this row; **file successor: triage+patch 12 open alerts (3 high)**. Successor proof: `gh api ...dependabot/alerts?state=open` shows zero high/critical (output) + green CI on the upgrade PR |
| Re-sync VISION_PROVIDERS into Doppler (3db31cb1, 06-10, config) | **unverifiable** | Reminder to push the corrected vision chain back to Doppler after workplace lockout | Valid hard blocker at filing; blocker lifted weeks ago, never revisited | If Doppler stale: next SessionStart resync silently reverts the scan chain — the exact CF_ACCESS_AUD failure mechanism, already fired once | Session denied .env read + doppler me; item's payload chain is itself outdated (08-05 re-pin to 2.5-flash + haiku); **note: 08-05 whats-next records VISION_PROVIDERS set in Doppler dev+prd — likely closes this, but that's the record not an executed diff** | Executed: `doppler secrets get VISION_PROVIDERS --plain -p portage` diffed against container env (match = 08-05 chain), then SessionStart sync + re-diff proving non-destructive (outputs) |
| Widen boot guard: required-key presence (73dd1664, 07-28, config) | **still-needed** | Refuse prod boot when R2/eBay/Stripe/Anthropic keys missing — generalizes PR #269 | Half banned shape, half genuine CI caution (ephemeral CI lacks those creds); caution justified sequencing, not silence | Whole silent env-gutting class open — bit twice in one week (07-26 login, 07-28 R2 photo 500s); next one boots clean and 500s at first use | env.ts superRefine (:81-98) validates ONLY CF_ACCESS_AUD; all named keys still plain .optional() (:12,:29-38,:43); extension point proven in-place | Vitest matrix (prod missing each key → named parse failure; dev/test exempt) green + executed negative boot: container minus one key exits 1 naming it; current prod env boots clean (outputs) |
| Ship-log MDX brace escaping (f25bc5f5, 07-02, docs) | **needs-operator-decision** | Generated `{stream:true}` text broke the whole docs site silently; generator lives in dhg-memreg | Valid repo-boundary constraint; but bundled the in-repo workflow hardening under the same excuse for a month | Deploy workflow TODAY still silent-fails and clobbers the good build for ANY docs edit (proven 07-02 failure mode, 5 silent failures) | deploy-docs.yml has no failure notification and nginx serves the build dir live (:52); ship-log dormant at 055; Q2 revive-vs-retire still open | Decision: revive (→ escaping fix required pre-first-entry) or retire (→ re-file in-repo hardening alone). Workflow proof: broken-MDX test dispatch → notification fires + live site keeps serving previous build (observed) |
| Docs cleanup Q-verdict worklist (a3455f37, 07-17, docs) | **already-done (1 residual)** | Post-audit doc edits unblocked by 15 Q-verdicts | Valid sequencing; executed within days | Residual E31 only: ship-log index still claims 55 sessions + dead links (tied to Q2 decision above) | Edit-pass log records every line (PR #238, merge 0835590); E31 verified NOT done (index.md unchanged) | Close citing PR #238 after one executed check (open two rewritten pages live); re-file E31 alone against the Q2 decision |
| README 4 factual errors (85dea545, 07-17, docs) | **already-done (1 residual)** | Wrong marketplaces/AI vendor/one-tap claim/mobile framing on the front page | Valid operator sequencing hold; resolved same day | Residual: README.md:21 still says 5 tabs (went stale hours later when PR #240 merged) | Commit 54ac7e9 via PR #238; all 4 corrections verified in current README.md:9 | Close on an executed render check of README; one-line 4-tab wording fix for the residual |
| Playwright storageState shared auth (d44b3c45, 06-10, testing) | **already-done** | Per-test logins tripped the auth limiter; single setup-project login now shared | Banned shape but moot — fixed ~30 min after filing | None; fix is load-bearing (limiter now 10-in-15min) | playwright.config.ts:26-42 + auth.setup.ts:13-41 — **hand spot-checked**; commit edc4459 via PR #108; survived CF Access migration | Executed: two back-to-back full e2e runs, zero auth 429s (run output) |

---

## §4 — Porter set (8 core items, all statuses)

Overlap note: items 1c0ae91e (vision 400) and 3db31cb1 (VISION_PROVIDERS) affect Porter's provider substrate but are tabled in §3. The top beta blocker — **qwen3:14b inventing inventory items** — is NOT a registry row yet; it's the paused work item 1 in whats-next.md (approach rejected 2026-08-05, redesign pending).

| Item | Verdict | What it is | Blast radius / risks | Evidence gathered | Proof to close |
|---|---|---|---|---|---|
| /porter/message empty vs local qwen3 (e6ac066f, medium) | **still-needed** | Non-streaming fallback returns blank 200 when a thinking model burns its 1024-token budget on hidden reasoning | **Live NOW: CHAT_PROVIDERS=local,gemini since 08-05 means the fallback endpoint blanks in prod config**, not just hypothetically | porter.ts:535-540 no maxTokens override; chatOpenAI default 1024 (ai-client.ts:794), extraction `|| ''` (:831); streaming path passes reasoning_effort (:571) but chatOpenAI's two create() calls don't (:796-802,:821-827) | Executed with local-first chain: POST /porter/message returns non-empty (output) + vitest pinning reasoning_effort sent and empty-content not returned as success |
| Porter update_item tool (eed1f6a5, medium) | **still-needed** | Porter can't edit inventory (3 read-only tools); users hit a capability wall in the flagship AI feature | Product-perception cost grows per beta user; write tool needs deliberate design (userId guard, user-field-authority rule) | porter.ts:48-83 exactly 3 tools; runToolCall (:91-202) handles only those; no deep-link fallback in PORTER_SYSTEM | Executed: "update item condition to excellent" in a live Porter chat → DB row changed (GET /items/:id output) + vitest with ownership guard |
| chatStreamOpenAI + Gemini switch (3fd52d03, medium) | **needs-operator-decision (stale)** | Code half DONE on main since 06-18 (f229db3: dispatcher, tool_calls delta assembly, reasoning_effort); the flip half happened DIFFERENTLY on 08-05: CHAT_PROVIDERS=local,gemini (qwen3 first, no Claude) — not the gemini-first flip this row describes | Row as written conflicts with two later decisions (3.5-flash demoted after drift outage; local-first per operator) | ai-client.ts:428-467,:540-639 implementation verified; buildChain provider:model override still vision-only (:119-121) — that sub-item genuinely open | Operator: rewrite/close row against the 08-05 local-first decision; remaining code work = chatModel override sub-item if still wanted. Proof for any flip: live Porter query with tool round-trip on the intended provider (Langfuse trace) |
| Dead AI_UNAVAILABLE guard (2d1797e3, low) | **still-needed (nit)** | Unreachable 503 guard in chatStream; misconfig boots to generic 500 instead of the advertised contract | Reader confusion only, today | ai-client.ts:436-439 guard vs buildChain throw (:126-128); SSE headers flush before await (porter.ts:373-379,:409) | Two-line fix + vitest: empty CHAT_PROVIDERS yields 503 AI_UNAVAILABLE on the non-streaming path (test output) |
| Porter conversation history UI (a0eb2e98, medium) | **needs-operator-decision (⅔ shipped)** | Dock history list + resume shipped (PR #252); **deep-links (`/porter?c=<id>`) and mobile history do not exist** | Mobile-first PWA: phone users cannot see/resume past conversations at all; reads as broken, not missing | porter-dock.tsx:99-121 + use-porter-conversations.ts:19 verified; zero searchParams handling in porter tab page; PorterDock is the hook's only consumer (desktop-only lg+) | Decision: accept dock-only (close vs PR #252) or require remainder — proof = mobile history screenshot + opening /porter?c=<real-id> resumes the thread |
| Voice parked removal (e37f4cd4, medium) | **already-done** | Voice pulled per operator decision, preserved at tag | None; re-release parked by design. **Codegraph still returns stale voice symbols — index rot; run codegraph sync** | Tag voice-parked-2026-07 exists; hooks/components/routes/compose entries verified absent (ls + text checks); CLAUDE.md records it | Close on executed checks already done this audit (tag listing + absence outputs); note codegraph sync |
| Orb gradient theme bug (f82a334c, low) | **already-done** | Orb faded near-black in light theme; fixed with theme-independent `--orb-core` | None | globals.css:47 — **hand spot-checked**; both call sites use it; commit f4e731b ancestor-of-main | Executed: light-theme home hero screenshot showing teal orb |
| Langfuse follow-ups (0a9f24b7, medium, infra) | **still-needed** | (1) per-purpose generation names (2) setActiveTraceIO migration (3) Ollama unreachable from prod container — the third now matters MORE: local qwen3 is Porter's primary | (3) if still live adds a failed round-trip + ERROR span to every Porter turn for real users — **and with local-first, an unreachable Ollama means Porter runs on gemini backup silently** | observeOpenAI no generationName (ai-client.ts:33); setActiveTraceIO load-bearing (tracing.ts:4,:99); 'local' branch present (:55-64); container→host reachability unverified from session | Executed: a Porter-turn Langfuse trace with zero Ollama ERROR spans and provider=local (trace screenshot); names porter-chat/scan-vision/prepare-listing visible; setActiveTraceIO removed with trace table still named |

**Pruned from Porter set (keyword-matched, assessed not Porter-core — one-liners, NOT reviewed):** Workbench small follow-ups; dhg-app-shell template extraction; dev-deps majors pass; Phase B fast-follows; per-workspace tdd-guard dirs; RecentListing.confidence chip; photo gallery v89 chunks 2-6; fix 6 pre-existing failing tests (billing PRO_TIER_LIMITS + batch-enhance).

---

## §5 — Medium/low open items (129, one-line index; not reviewed this audit)

| Filed | Pri | Cat | Title |
|---|---|---|---|
| 2026-05-16 | low | infra | Incidents table KB integration — 99% alert noise |
| 2026-05-16 | low | infra | agent_sessions embeddings — FTS only currently |
| 2026-05-16 | low | api | scan.ts R2 upload catch block loses userId |
| 2026-05-16 | low | marketplace | Etsy recommends 2000px+ for zoom — current MAX_DIMENSION=2048 borderline |
| 2026-05-16 | low | marketplace | Reverb min 620px width — no validation exists |
| 2026-05-16 | low | api | Consolidate analyzeImage/analyzeImages duplicate provider loops |
| 2026-05-16 | low | frontend | ProcessedImage.format should be literal union type |
| 2026-05-16 | low | infra | generate-ship-log.sh ARG_MAX risk on large registry responses |
| 2026-05-16 | low | infra | capture-sweep-reminder.sh heredoc subshell fragility with paths containing spaces |
| 2026-05-17 | low | infra | Loop 4 mid-session reinforcement — corrections only surface at session start |
| 2026-05-17 | low | api | Promo codes and coupon support |
| 2026-05-17 | low | marketplace | Reverb token revocation detection |
| 2026-05-17 | low | api | Add row limit to GET /items/export query |
| 2026-05-27 | low | testing | SSRF regression test for photo export — verify fetch not called for disallowed origins |
| 2026-06-03 | low | marketplace | Store eBay refresh-token 18-month expiry + reconnect prompt |
| 2026-06-03 | low | marketplace | Fix fetchEbayAppToken(forceProd=false) sandbox-creds-on-prod-URL inconsistency |
| 2026-06-03 | low | testing | Add test for eBay Identity fetch network-error (throw) path |
| 2026-06-03 | low | config | Tune TDD-guard: false-positives on cross-file wiring + stale-assertion fixes |
| 2026-06-03 | low | marketplace | Orphaned eBay inventory_item cleanup sweep |
| 2026-06-03 | low | api | Seller profile GET auto-create race condition — needs upsert |
| 2026-06-04 | low | api | DRY: extract shared fetchEbayPolicies helper for GET /ebay-policies and POST /ebay/auto-setup |
| 2026-06-04 | low | api | Surface a draft-fallback warning for publishMode=live failures in POST /listings |
| 2026-06-05 | low | infra | Reconcile stale repo .claude/scripts/post-*.sh duplicates with dhg-memreg shims |
| 2026-06-05 | low | api | Fix express-rate-limit ERR_ERL_KEY_GEN_IPV6 thrown from billing.ts rateLimit() config |
| 2026-06-06 | low | performance | Cache EbayAdapter.getRequiredAspects per category (24h TTL) |
| 2026-06-06 | low | marketplace | Surface a warning when getValidConditions returns [] on Metadata API failure (avoid silent fallback to USED_GOOD) |
| 2026-06-07 | low | marketplace | getFulfillmentPolicy: distinguish 4xx-propagate vs network fail-open |
| 2026-06-07 | low | frontend | Orphaned /inventory/[id]/edit route page — not linked anywhere |
| 2026-06-08 | low | frontend | Item detail read view does not surface items.price (only AI estimate shown) |
| 2026-06-08 | low | marketplace | Setup leaves orphaned eBay *Copy fulfillment policies (e.g. Portage Standard Fulfillment Copy, FLAT_RATE) |
| 2026-06-09 | low | frontend | Add RecentListing.confidence field + render confidence % chip on home listing cards |
| 2026-06-09 | low | frontend | Aspect seeding suggests single-letter enumerated values (e.g. Series ✨A) from article words |
| 2026-06-10 | low | frontend | Distinguish category-resolution outage from genuine no-match in scan flow |
| 2026-06-10 | low | frontend | aspect-fill-sheet still uses forest-green classes (pre-DHG tokens) |
| 2026-06-10 | low | infra | Metrics coverage for category-aspects and getValidConditions cache behavior |
| 2026-06-10 | low | marketplace | Verify Etsy real description length limit for footer guard (descriptionLimitFor non-eBay default 50k) |
| 2026-06-10 | low | api | Best Offer observability log lines: bestOfferTerms inversion-guard drop + applyFooter over-limit drop |
| 2026-06-10 | low | marketplace | updateListing warning contract for Etsy/Reverb adapters (eBay returns warnings; others never do) |
| 2026-06-11 | low | auth | Refresh defense-in-depth: assert JWT sub === session.userId; misc auth edges (register stayLoggedIn, 200-with-bad-json, createSession helper) |
| 2026-06-11 | low | testing | scan-flow condition-snap test flaky on CI runner (passes 5/5 locally, failed once in CI) |
| 2026-06-11 | low | frontend | Phase B fast-follows: price clearing, per-flow warning prop tests, AI-weight path test, ScanFab dead component, draft-reason persistence |
| 2026-06-12 | low | frontend | Seller-profile settings page section cards use hardcoded rgba(0,0,0,0.03/0.08) backgrounds |
| 2026-06-16 | low | marketplace | Add error-context to EbayAdapter.request() success-path JSON.parse |
| 2026-06-17 | low | marketplace | GET /seller-profile/ebay-policies does not filter marketplaceAccounts by marketplace=ebay |
| 2026-06-22 | low | api | Lever A hardening: add response_format json_object to chatText OpenAI no-tools path |
| 2026-06-23 | low | frontend | Rename/remove DisclaimerSheet listingId prop (fed itemId; only a useEffect dep) |
| 2026-06-27 | low | config | Resolve tdd-guard apps/web exemption drift (config vs frontend-verification skill) |
| 2026-06-27 | low | docs | Wire Envato Market API to fetch purchased fonts into the repo |
| 2026-06-28 | low | marketplace | Seller-configurable inline shipping/return fields for Trading listings |
| 2026-06-30 | low | database | Reconcile stale eBay listing row 307034606520 (active locally, ended on eBay) |
| 2026-06-30 | low | api | 1.20 dead-code sweep: remove orphaned Inventory-era helpers + inert ebayOfferId column |
| 2026-06-30 | low | infra | Install gh system-wide (apt repo + sudo) and remove the per-user ~/.local/bin/gh |
| 2026-06-30 | low | config | Tune the no-force-push agentlint rule — it over-fires on normal pushes and branch deletes |
| 2026-06-30 | low | config | Fix SessionStart active-ship-state pointer — picks a stale ship-state file after ship-state.md was gitignored |
| 2026-07-02 | low | api | pino-http 10->11 major bump (api) |
| 2026-07-02 | low | frontend | Delete dead capture components: capture-sheet.tsx + photo-capture.tsx |
| 2026-07-02 | low | infra | dhg-docs nginx trailing-slash 301 drops the :8017 port |
| 2026-07-08 | low | config | Dedupe APP_URL + quote RESEND_FROM in .env.example |
| 2026-07-09 | low | api | Unwind the inert /:id/publish policy-ID self-heal block (32-test mock refactor) |
| 2026-07-10 | low | docs | Regenerate docs sitemap SVGs (gen_sitemaps.py) — route counts stale |
| 2026-07-11 | low | frontend | Hoist duplicated listing status-pill config into shared module |
| 2026-07-14 | low | infra | R2 reference-safe photo deletion (orphan GC) |
| 2026-07-15 | low | frontend | Scoped Cache-Control exception for /tutorials/** static PNGs |
| 2026-07-16 | low | frontend | Live list↔pane field sync in workbench |
| 2026-07-16 | low | frontend | Workbench list pane: full aria listbox/roving-tabindex semantics |
| 2026-07-16 | low | frontend | Workbench small follow-ups: replaceState param clobber, unauth redirect target, desktop toast offset, data-item-id naming |
| 2026-08-01 | low | testing | Flaky CI test: seller-profile policy-cleanup ZIP guard (save spy fires once on CI only) |
| 2026-08-03 | low | frontend | Retire the photo-save UI mutex in item-detail now that photo sync is async |
| 2026-05-16 | medium | infra | Cron job for periodic re-ingest of memory files |
| 2026-05-16 | medium | docs | Docusaurus site restructuring for multi-project (Option B) |
| 2026-05-16 | medium | testing | image.test.ts — core image functions have no unit tests |
| 2026-05-16 | medium | marketplace | Multi-item eBay orders only sync first line item |
| 2026-05-16 | medium | marketplace | Hardcoded marketplaceFees: 0 for Etsy and Reverb |
| 2026-05-16 | medium | testing | Add unit tests for normalizeCondition, normalizeEbayCondition, extractJSON |
| 2026-05-16 | medium | security | session-capture.sh JSON injection via unescaped branch names |
| 2026-05-27 | medium | other | export_tokens cleanup job |
| 2026-06-02 | medium | infra | TTS (chatterbox) GPU support blocked by RTX 5080 Blackwell sm_120 — needs PyTorch 2.7+/CUDA 12.8+ |
| 2026-06-03 | medium | marketplace | Build Etsy OAuth callback page (same missing-bridge gap as eBay) |
| 2026-06-03 | medium | marketplace | Replace in-memory OAuth stateStore with DB-backed oauth_state table |
| 2026-06-03 | medium | testing | Fix 6 pre-existing failing tests on main (billing PRO_TIER_LIMITS + batch-enhance) |
| 2026-06-03 | medium | marketplace | Etsy marketplace wiring fix — same marketplaceSpecificFields gap as eBay |
| 2026-06-03 | medium | testing | batch-enhance route unimplemented — 4 failing tests in untracked batch-enhance.test.ts |
| 2026-06-04 | medium | marketplace | Auto-pull eBay seller address (+name/email/phone) from Commerce Identity API on OAuth connect |
| 2026-06-04 | medium | docs | Review + commit/deploy eBay API reference doc (website/docs/api/ebay.md) |
| 2026-06-05 | medium | frontend | Resume photo gallery feature ship (v89) — chunks 2–6 remaining |
| 2026-06-07 | medium | testing | batch-enhance.test.ts — 4 failing tests (pre-existing) |
| 2026-06-08 | medium | frontend | Full scan review-step extraction (only the action bar + price was extracted) |
| 2026-06-09 | medium | frontend | Wire frontend caller for POST /images/batch-enhance (enhance-all-photos UX) |
| 2026-06-09 | medium | frontend | Add seller default listing footer (boilerplate appended after AI description) |
| 2026-06-09 | medium | marketplace | User-configurable pricing percentile bands in Settings (seller_profiles) |
| 2026-06-09 | medium | marketplace | Verify eBay Taxonomy API rate-limit budget (up to 3 taxonomy calls per scan vs app-token bucket) |
| 2026-06-09 | medium | infra | Per-workspace tdd-guard data dirs to fix parallel-track test.json contention |
| 2026-06-09 | medium | frontend | Nested <button> in scan photo strip causes React hydration error warning |
| 2026-06-10 | medium | frontend | useRequiredAspects needs isError flag — Complete badge can show on fetch failure |
| 2026-06-10 | medium | frontend | Condition snap should notify the user when their selected condition is changed |
| 2026-06-10 | medium | other | Shared-types pass for the 4 sync-by-comment contracts in scan aspects feature |
| 2026-06-10 | medium | infra | R2 portage-images bucket CORS blocks LAN dev origins — photo recognition broken from 10.0.0.251 |
| 2026-06-10 | medium | frontend | Surface comps-fetch failures in scan-flow (empty .catch swallows pricing-data errors) |
| 2026-06-10 | medium | frontend | Migrate inventory/[id] photo editing onto usePhotoEdit + collapse photoIndex/editingPhotoIndex dual state |
| 2026-06-11 | medium | frontend | Shipping label CTA silently no-ops while carrier integration is stubbed — surface or hide until carrier release |
| 2026-06-11 | medium | auth | Multi-tab refresh rotation race: losing tab gets logged out (UX) — grace window or storage-event sync |
| 2026-06-11 | medium | frontend | use-scan-aspects: track resolvedFor + resolveError; manual-override flag vs title auto-resolve |
| 2026-06-15 | medium | marketplace | Surface eBay error parameters (e.g. ATO_TASR_block account lock) instead of the generic errorId 25019 message |
| 2026-06-21 | medium | security | orders.ts decrypts Reverb token directly instead of using token-manager getReverbAccessToken() |
| 2026-06-21 | medium | marketplace | EbayAdapter has two divergent UA-injection paths: request() vs 4 static methods inlining EBAY_USER_AGENT |
| 2026-06-22 | medium | marketplace | updateListing aspect handling less defensive than createListing (F6) |
| 2026-06-23 | medium | frontend | Scan review: move Quantity field to the left of Price in the bottom action bar |
| 2026-06-28 | medium | marketplace | Evaluate eBay Inventory Mapping API (GraphQL AI listing-preview) as post-refactor AI listing-quality enhancement |
| 2026-06-30 | medium | frontend | Frontend should send a stable idempotencyKey on publish (POST /listings) |
| 2026-06-30 | medium | marketplace | 1.20 dead-code: remove now-unused eBay Business-Policy adapter methods + FE Set-up-eBay button |
| 2026-07-02 | medium | infra | Dev-deps majors pass: eslint 10 (root+web), @types/node 26, vitest 4, TypeScript 6 |
| 2026-07-02 | medium | api | Zod 3->4 migration (api + root) as dedicated ship |
| 2026-07-02 | medium | marketplace | Reconcile externally-ended eBay listings — local rows stay active forever |
| 2026-07-08 | medium | frontend | Web sends no idempotencyKey on publish — failed publish retries accumulate orphan draft rows |
| 2026-07-11 | medium | marketplace | Reverb listings do not sync on item edit — extend PATCH /items revise loop beyond eBay |
| 2026-07-11 | medium | security | Harden pull_request workflows running on self-hosted runner before public launch |
| 2026-07-11 | medium | marketplace | Item bbaddd00 eBay edit-sync silently fails: valid leaf category required |
| 2026-07-11 | medium | infra | R2 bucket CORS rule for portage-images (needs R2 Admin token) |
| 2026-07-14 | medium | marketplace | eBay updateListing: hasContentChange treats any photos array as content change — fast path dead |
| 2026-07-14 | medium | performance | Thumbnail variant pipeline for photo strips (24 full-res thumbs) |
| 2026-07-15 | medium | infra | Extract responsive shell as deployable DHG template (dhg-app-shell) |
| 2026-07-16 | medium | frontend | Mobile deep link ?item=/?listing= mounts hidden fetching ItemDetail |
| 2026-07-16 | medium | frontend | Workbench filter-out behavior diverges: inventory keeps pane open, listings clears it |
| 2026-07-16 | medium | frontend | Inventory filter row crowding at 390px — chips truncated by count + view toggles |
| 2026-07-17 | medium | infra | Two infra changes awaiting Stephen go: rehearsal:3004 ingress delete + :8018 landing to /explore/ |
| 2026-07-17 | medium | infra | Expose session_reports as a /api/kb/search source in DHG Registry |
| 2026-07-17 | medium | infra | deploy-docs.yml img copy accumulates deleted files — needs rsync --delete |
| 2026-07-27 | medium | marketplace | Marketplace submission panel additions: ad bump (Reverb/eBay), make-offer toggle + min/auto-accept, eBay shipping controls |
| 2026-08-02 | medium | frontend | Reverb category: scan-review ride-along + listing-card inline edit |

---

## §6 — Advisor summary

### Headline numbers

- **21 of 53 reviewed items (40%) are already done or obsolete** — the crit/high registry is heavily stale. Ships happened; rows never closed. Registry closure is a separate operator-approved pass (this audit wrote nothing).
- **21 still genuinely needed**, concentrated in: marketplace-truth sync (status reconcile, Reverb orders, beta scoping — one capability family), enforcement infra (3 criticals + latency + dead-end audit), and the four 08-05 beta-blocker UI items.
- **6 need an operator decision** (listed below). **1 unverifiable** from inside a session (Doppler read denied).

### Operator decisions queued (each blocks its row)

1. **eBay Account Deletion endpoint** (c683b4bc) — 5-minute dev-portal check: exempt or build. Highest severity-if-realized in the audit.
2. **docs.digitalharmonyai.com** (c6f43445) — PUBLIC vs GATED.
3. **Ship-log Q2** (f25bc5f5 + 2e2201ce residuals) — revive vs retire; the deploy-workflow hardening should proceed either way.
4. **Porter history remainder** (a0eb2e98) — accept dock-only or require deep-links + mobile.
5. **Batch-enhance** (c8e0e606) — fresh design pass + build, or drop and remove the orphaned endpoint.
6. **/about vs /legal/terms retarget** (610ee575) — recommend retarget (hours vs page build).
7. **Gemini-400 zombie row** (1c0ae91e) — authorize the one-scan Langfuse re-test to close it.
8. **chatStreamOpenAI row rewrite** (3fd52d03) — reconcile against the 08-05 local-first decision.

### New findings surfaced by this audit (not yet filed anywhere — filing needs your approval per deferral-gate)

- **12 open Dependabot alerts today: 3 high** (fast-uri, ip-address, undici) — post-#257 accumulation, live-checked via gh api.
- **e2e.yml runs pull_request for ALL PRs ungated on the stateful self-hosted runner** — the TODO item's text is stale (deploy-docs no longer exposed) but the real exposure is live.
- **capture-guarantee.py cwd bug** blocks the global backstop wiring (66096dd7's missing half).
- **deploy-docs.yml silent-failure + live-dir clobber** applies to every docs deploy, not just ship-log.
- **codegraph index rot** on removed voice files — `codegraph sync` recommended.

### Contradictions found (not silently resolved)

- Carrier row open/high vs CLAUDE.md superseded → advisors confirm superseded (PR #142).
- 3fd52d03 targets gemini-first vs operator 08-05 CHAT_PROVIDERS=local,gemini.
- TODO.md: R2/R3 checkboxes vs PR #252 reality; deploy-docs.yml claim vs current triggers; header test counts two refreshes behind; CLAUDE.md trio refresh exists only uncommitted.
- Registry says "graphify/codegraph current" while codegraph returns deleted voice symbols.

### Deferral-rationale pattern (evidence for the 08-03 rule)

Of 53 reviewed: **19 rows carry banned-shape rationales** ("out of scope", "keeps the batch clean", "fix not yet requested"). All predate or skirt the 08-03 rule; notably, most of the *already-done* rows were fixed within hours-to-days of filing — the deferral records outlived the deferrals themselves, which is exactly how a 40%-stale backlog formed. The three rows filed 08-05 with "beyond emergency triage scope" (25afd214, 307ffa75, 98f9f383/b6536cc1) currently stand **without the per-item approval the rule requires** — they need either your approval-on-record or a build slot.
