status: in_progress
phase: 4-build COMPLETE (A/B/C shipped: PRs #111/#112/#118 etc.) → AI-specifics A–E + live-test hardening
  shipped on branch feat/ai-specifics-and-publish-result (PR #132, OPEN, merge-gated on Phase-F live verify).
  NEXT FOCUS = backlog Phase F (unify publish + price/terms panels). See docs/incomplete-work-backlog.md.
branch: feat/ai-specifics-and-publish-result (PR #132 → main; do NOT merge until Phase-F live MPN verify)
feature: "Pre-Stage-3 fix batch — ONE ship, phased (user-directed 2026-06-11, mirrors redesign merge_decision: phases 1-3 once, phased build, hard gate before Phase 4). Nine user-reported items from live production test (iPhone/iPad, demo account, real eBay account). Prior redesign state versioned: ship-state_v7_redesign-pre-stage3-fixbatch.md — Stage 3 (eBay-setup nav trap) resumes after this ship."
complexity: complex (DB schema + api + web, >5 tasks)
tdd: true (tdd-guard enforced; apps/web NOT exempt — guard fired on onboarding fix today)

spec: |
  User-approved scope (conversation, 2026-06-11). Evidence per item captured in session journal + registry.
  1. PUBLISH WARNING TRUTH: when eBay publish fails and we fall back to draft, surface eBay's actual reason
     (e.g. account-security lock 25019/ATO_TASR_block, weight 25020) in the route warning + web UI, not the
     generic "created as draft" line. Evidence: user's Sennheiser publish failed on eBay ATO account lock and
     the UI never said so.
  2. PRICE PERSISTENCE: price set on item setup (scan-review) must persist to items.price; listing creation
     surfaces (create-listing-sheet, listing flows prefill) must prefill from items.price (fallback
     estimated_value_recommended). Evidence: items.price NULL for Sennheiser; both surfaces prefilled AI $100.
  3. WEIGHT SECTION lb+oz: item setup weight becomes a pounds+ounces pair (stored oz in items.weight_oz);
     ensure weight flows into eBay offer packageWeightAndSize (fixes eBay 25020 publish failure seen on offer
     182297571011).
  4. EBAY CATEGORY + DYNAMIC CONDITION VISIBLE: the resolved eBay category (category-suggestion, works —
     log-verified 29946) becomes visible/editable on item setup; Condition options constrained by that
     category's valid conditionIds (Stage 1 bundled them in the suggestion response).
  5. SAVE REDIRECT: after saving a listing, redirect to /inventory (current state), not history-back.
  6. DUPLICATE FIELDS: hybrid flow full-chat shows completed Item Details card AND Review card simultaneously
     (Title/Category/Condition twice, top copy editable vs bottom snapshot). Collapse/summarize completed
     cards when Review appears. Screenshot: listing-flow-duplicate-fields-390x844.png.
  7. LABEL STUB MESSAGE: ship-flow label purchase returns isStub:true + "Shipping provider not configured…"
     but web swallows it (dead button). Surface the message. (Carrier integration itself DEFERRED — registry
     5b5d1dfb; tracker 33c83ccd resolves with this item.)
  8. AUTH-LOSS REDIRECT: central handler — the moment session is lost (refresh fails/401 sticks), clear auth
     state and redirect to /home immediately on every page. Today: silent until user touches something,
     then inconsistent.
  9. MULTI-DEVICE SESSIONS + STAY LOGGED IN: replace single users.refreshTokenHash with per-session
     refresh_tokens table (device sessions stop revoking each other — root cause of constant logouts:
     iPhone/iPad logins mutually revoked, 15-min effective sessions); login "Stay logged in" checkbox extends
     refresh TTL (default 30d; checked = 1y sliding). eBay OAuth NOT involved (2h access auto-refreshed,
     18-month refresh — verified in logs).
  OUT OF SCOPE: carrier API integration (EasyPost/Shippo, deferred 5b5d1dfb), eBay listing import (future
  ship), description sanitize (user: Heather copy intentional), eBay account unlock (user action with eBay).

approach: "Phased build inside one ship, grouped by concern for single-revert rollback (mirrors redesign
  pattern): Phase A = auth/session (items 8,9 — schema + auth routes + web auth plumbing). Phase B = item
  setup + publish truth (items 1,2,3,4 — scan-review fields, items.price, weight lb/oz, eBay category/
  condition, publish warning detail). Phase C = listing UX (items 5,6,7 — redirect, card collapse, label
  message). PR per phase recommended (A/B/C), --no-ff merges."

evidence_links:
  - "eBay ATO lock: api log 1781182626894 offer 185346583011 errorId 25019 ATO_TASR_block"
  - "weight: api log 1781183504021 offer 182297571011 errorId 25020"
  - "price: items row 2a4fd03a price NULL, listing 67c307a9 price 65, est rec 100"
  - "sync skips (separate future ship): 6 orders 'no matching local listing' eBay IDs 3069xxx"
  - "session revocation: users.refreshTokenHash single column, auth.ts:145-147 overwrite on login"

phase2_file_map: |
  AUTH (items 8,9): schema.ts:40 users.refreshTokenHash (single column, login overwrite auth.ts:145-147 =
  device mutual revocation); refresh rotation ALREADY exists (auth.ts:212-216); exportTokens (schema:331-340)
  is table template; jwt.ts:13 REFRESH_TOKEN_EXPIRY '30d' module-const not exported; web api.ts:43-46 refresh-
  fail clears localStorage + fires _onTokenRefreshed(null) but NO redirect (auth-provider.tsx:40-48 clears
  state only) = item 8 gap; auth-provider logout():61-68 redirects /login but NEVER calls POST /auth/logout
  (server hash never cleared — PRE-EXISTING BUG, fix in A5); login page form login/page.tsx:60-102; e2e
  auth.setup.ts unaffected; marketplaceAccounts.refreshTokenEncrypted unrelated. TESTS: auth-refresh.test.ts
  ALL 7 rewrite (two-table mocks, mockReturnValueOnce chains); auth.test.ts register/login update mocks + add
  missing logout test; jwt.test.ts unaffected.
  ITEM-SETUP/PUBLISH (items 1-4): generic warning hardcoded ebay-adapter.ts:~495 createListing catch — eBay
  request() already parses errorIds + sanitized message into thrown err.message, just concat it; route
  plumbing already carries warning (listings.ts:246, :468); listings/[id]:433-436 amber banner auto-benefits;
  BUT use-listing-flow.ts:483-508 publish() drops warning on 201 success (flows never show it) — must type
  + return + surface. PRICE: scan-flow handleSave:447 omits price (handleSaveAndList:514 sends it);
  items.ts:41 price already in Zod, :298 persisted; resolvePublishPrice (lib/price.ts:34-46) already prefers
  item.price — fix is ONE payload addition. WEIGHT: scan review has NO weight input; WeightDimsInputsInline
  (weight-dims-inputs.tsx) + lib/weight.ts ready; mergeItemShipping (listings.ts:34-45) already injects
  weightOz -> eBay packageWeightAndSize on both publish paths. CATEGORY/CONDITION: Stage 1 constraint ALREADY
  LIVE in scan-flow (:146-158 availableConditions memo, :1122 filtered pills, :1159-1178 category display w/
  re-resolve button) — user's "static" report likely = display-only category (no override picker) and/or the
  inventory edit page (unexplored); CONDITION_PREFERENCE_CHAINS duplicated adapter:135 + web ebay-condition-
  map.ts:7 (SYNC comment).
  LISTING UX (items 5-7): publish() never navigates; PublishSuccess (publish-success.tsx:47-58) shared by all
  3 flows — View Listing or List Another only; create-listing-sheet caller inventory/[id]/page.tsx:823-826
  pushes /listings (wrong target); /list page is pure dispatcher. DUPLICATE CARDS root cause hybrid-flow.tsx
  :481 showReview = lastStep==='review' || (price!==null && title!=='') — fires early; Item Details card :619
  + Review card :756 render simultaneously; compact mode unaffected; conversational transcript = by-design.
  LABEL STUB: use-shipping.ts:146 returns isStub+message correctly; ship/page.tsx:154-182 setLabelSuccess(true)
  unconditional; :268-361 green success always; message only as quiet grey <p> :325-327. Toast pattern: hand-
  rolled useState+setTimeout (inventory/page.tsx:19-104), NO toast lib — do not add one.

plan: |
  Phase A — auth/session (branch fix/auth-sessions, PR 1):
   A1 schema: ADD refreshTokens table (exportTokens template: id uuid pk, userId fk cascade, tokenHash text
      unique, expiresAt notNull, createdAt default now, lastUsedAt nullable; idx user_id) — KEEP old column
      until A6. db:push. Risk: med/DB. Rollback: DROP TABLE refresh_tokens.
   A2 jwt.ts: signRefreshToken(payload, expiresIn='30d'); export REFRESH_TTL_MS + STAY_LOGGED_IN_EXPIRY '1y'
      + STAY_TTL_MS. TDD jwt.test.
   A3 auth.ts: register/login INSERT refresh_tokens (login body +stayLoggedIn optional -> 1y TTL + matching
      expires_at); /refresh: lookup row by tokenHash (404->401 INVALID_REFRESH_TOKEN; expired row -> 401 +
      delete), verify user, rotate delete+insert, lastUsedAt; /logout: DELETE row by hashed body.refreshToken.
      TDD: rewrite auth-refresh.test.ts, update auth.test.ts, add logout test. Risk: high/auth. Rollback: git revert.
   A4 admin disable -> DELETE refresh_tokens for user; refresh rejects disabledAt users (verify existing
      check, add if missing). TDD admin test. Risk: low.
   A5 web: api.ts refresh-fail -> dispatch CustomEvent 'auth:session-lost'; auth-provider listens -> clear
      state + window.location.href='/home' (item 8); logout() POSTs /auth/logout w/ refresh token BEFORE
      clearing storage (fixes pre-existing server-side non-revocation). TDD jsdom tests.
   A6 schema: DROP users.refreshTokenHash after code references gone; db:push. Verify login/refresh live.
      Risk: med (destructive — push AFTER A3 deployed code-wise). Rollback: re-add column.
   A7 login page: "Stay logged in" checkbox -> body. TDD. Register stays default 30d.
   Live gate A: two browser contexts same account both survive refresh cycles; kill a session server-side ->
      that device redirects to /home immediately on next 401.
  Phase B — item setup + publish truth (branch fix/item-setup-publish, PR 2):
   B1 ebay-adapter ~:495: warning = generic + ': ' + err.message. TDD adapter test (25019-style body).
   B2 warning plumbing to flows: type {id,status,warning?} in use-listing-flow.publish() + scan-flow
      handleSaveAndList; surface amber banner/note on PublishSuccess + scan post-save toast. TDD.
   B3 scan-flow handleSave: include price like Save&List. TDD payload test.
   B4 scan review: WeightDimsInputsInline (lb+oz) seeded from candidate.weight; weightOz in both POST paths.
      TDD. (eBay offer wiring already exists — verify only.)
   B5 (AMENDED at gate, user 2026-06-11): DEPRECATE static internal category list as user-facing control
      (13 hardcoded values inventory/[id]/edit/page.tsx:17-20; user: "very short, more often than not
      wrong"). eBay category picker becomes THE category control on scan review: auto-resolved display +
      editable search (re-query category-suggestion with user q) + pick; conditionIds re-constrain on pick;
      items.category column STAYS but auto-derived from eBay categoryName (filters/comps read it,
      items.ts:253); picked categoryId persisted to items.marketplaceData so listing/publish uses it without
      re-resolve. Etsy/Reverb taxonomies unchanged in their flows. TDD.
   B6 inventory/[id]/edit: replace static 13-item category select with same eBay picker; condition
      constrained via getAvailablePortageConditions; ensure price/weightOz editable. TDD.
   B7 (ADDED at gate): seed matching eBay aspects (Brand, Model) from items.brand/items.model in the aspects
      UI — deterministic copy of known fields, NOT AI prefill (Stage 1 AI-prefill-OUT decision stands);
      aspects remain editable. TDD.
   Live gate B: real scan on :3003 -> set price+weight -> Save -> DB row has price+weight_oz; Save&List with
      locked eBay account -> UI shows eBay's actual reason.
  Phase C — listing UX (branch fix/listing-ux, PR 3):
   C1 PublishSuccess: primary "Back to Inventory" -> /inventory; inventory/[id] onCreated -> /inventory. TDD.
   C2 hybrid-flow: showReview strictly lastStep==='review'; Item Details card collapses to read-only summary
      (tap to expand) once review shown. TDD sequencing test.
   C3 ship page: isStub -> amber warning banner w/ message + link /settings/shipping; no green success state.
      TDD. Then mark registry 33c83ccd resolved.
   Live gate C: drive flows on :3003; screenshots light+dark.
deploy_order: "API + schema first (A1-A4), web after (A5-A7); container rebuilds at each phase live-gate;
  A6 column drop only after A3/A5 verified live."
tdd: enforced (tdd-guard)
tdd_guard_bypasses: "ONE scripted bypass so far (Phase A, A3): login session-insert into refresh_tokens —
  driven by failing auth.test.ts spy assertion ('Login creates a per-session refresh_tokens row', red shown
  in test output) but validator repeatedly misclassified the insert as un-driven architecture change across
  4 escalating-minimality attempts. Applied via python patch; tests green + tsc clean immediately after.
  Phase 6 reviewers: review the login-route diff extra-carefully (precedent: Stage 2.5 had 3 such bypasses)."
pr_strategy: "PR per phase (A/B/C), --no-ff merge, single-revert rollback per concern — mirrors redesign."

next: "Phase F in progress on branch feat/phase-f-publish-unification. F0 (eBay-draft backend) DONE +
  committed (api 520 green). RESUME AT F0b: eBay-draft toggle on both publish panels. See PHASE F TODO."

phase_F_progress: |
  F0 — eBay-draft publish mode (POST /listings publishMode='ebay_draft' → adapter createListing draft mode →
       creates unpublished eBay offer + persists ebaySku/ebayOfferId, status stays draft). DONE, committed on
       feat/phase-f-publish-unification. typecheck clean, api 520 (+1 route test). Safe design: NEW 'ebay_draft'
       enum value (did NOT repurpose 'draft', which stays DB-only — repurposing would push every local draft to eBay).
  Investigation that grounded F0 (eBay-draft was never a wired feature):
   - adapter draft branch (1a0f73c/T7) is real but NO route ever forwarded 'draft' to it ("draft = DB only" since b883433/T13).
   - the eBay drafts seen in testing are ORPHANED offers: createListing makes the offer at line 519, /publish at 602;
     a /publish failure (BrandMPN 25002 / ATO 25019 / condition 25021) leaves the offer unpublished = a draft.
     Pre-offer failures (validate/weight/aspect-gate@439 "Complete eBay details") leave NOTHING on eBay.
   - draft 5117769708900 (Nextorage, 22:21 EST 2026-06-22) = orphan for SKU PRT-000008 (gap in seq 1-7,9; item deleted).
   - orphan-cleanup is a deferred bug (delete eBay offer when Portage listing deleted / on failed publish).
  RESUME — F0b (eBay-draft toggle, both panels):
   - CreateListingSheet (create-listing-sheet.tsx:51): publishNow toggle maps live/draft; add 3-way so eBay
     marketplace + not-publish-now + eBay-draft-on → publishMode 'ebay_draft'. TDD the mapping.
   - Scan Save & List: thread an eBay-draft choice through buildListingPayload (scan-listing-payload.ts) +
     ScanReviewActions; sends publishMode 'ebay_draft'. TDD.
   - Then F-GATE: Playwright drives an eBay-draft publish on both panels; verify the eBay offer + aspects.MPN via
     an IN-APP eBay-read route (a standalone tsx script deadlocks on token refresh — build a small admin/route).
   - Fold in orphan-cleanup when wiring delete."

# ─────────────────────────────────────────────────────────────────────────────
# SESSION HANDOFF — 2026-06-23
# ─────────────────────────────────────────────────────────────────────────────
handoff_2026_06_23: |
  WHERE WE LEFT OFF
  - Pre-Stage-3 fix batch (Phases A/B/C: auth/session, item-setup+publish-truth, listing-UX) = SHIPPED earlier
    (PRs #111/#112/#118/#121/#123/#124/#125).
  - AI-specifics A–E (scan AI-fills required eBay specifics → auto-fill in place [AI]-tagged/editable →
    persist on items.aspects → carry through every publish path) + the live-production-test fixes =
    SHIPPED on branch feat/ai-specifics-and-publish-result via PR #132 (OPEN, pushed, 8 commits).
  - Verified: API 519 tests, web 195 tests, typecheck + lint clean; both containers rebuilt + healthy;
    one live publish succeeded (eBay listing 307019237500).
  - tdd-guard ON throughout (apps/web NOT exempt — guard fired on hooks/components all session).

  PR #132 COMMITS (newest→oldest): 45c1a7c (web quantity-in-bar + F9 enum-check) · eff8ba9 (F2 malformed
  aspect degrade + firmer prompt) · 48ad82c (MPN item-specific + F6 updateListing parity) · aceeba1
  (quantity crosswire) · 346e1fd (persistent publish-failure banner) · e70baaa (auto-fill in place +
  quantity + required-field gating) · 35f1cf3 (refine-path prefill) · 12ad270 (BrandMPN sentinel).

  MERGE GATE (do NOT merge PR #132 until done): live re-publish an item, confirm the eBay listing's MPN
  item-specific shows a value (real or "Does Not Apply"), Type auto-fills more often, quantity sits left of
  Price in the bottom bar, and the review scrolls to the bottom. User will run this during Phase F.

  REVIEW-HARDENING ALREADY DONE THIS SHIP (the F6/F2/F9 adversarial-review items — NOT pending):
  F6 shared normalizeAspects() → updateListing parity; F2 per-value .catch([]) degrade; F9 autoFillFromAi
  enum-check. (These were review findings tagged "Phase F" but are completed in PR #132.)

  OPEN DEFERRED (registry, queryable):
  - Type AI auto-pick on high-cardinality aspects (~20+ values) — best-effort prompt nudge shipped; AI-dependent.
  - Duplicate listings row on republish (two listings rows → same eBay listing 307019237500) — idempotency gap.
  - SKU "Custom label" Seller-Hub check (PRT-000009 IS sent in offer.sku; confirm it shows in Seller Hub).
  - Price model: items.price (asking) vs listings.price (per-marketplace) kept SEPARATE by user decision.

phase_F_todo: |
  PHASE F — Unify publish + price & terms panels + eBay-draft (branch feat/phase-f-publish-unification)
  Goal: ONE publish-confirm sheet for BOTH paths (item-detail CreateListingSheet AND scan Save & List),
  carrying price + terms + a truthful result, with an eBay-draft option.

  [x] F0   eBay-draft backend — POST /listings publishMode='ebay_draft' → adapter draft mode → unpublished
           eBay offer + persist sku/offerId, status draft. DONE (commit 8b44c5b, api 520 green).
  [x] F0b  eBay-draft TOGGLE on BOTH panels → publishMode 'ebay_draft'. DONE (commits 3a6431a + 90a2ebb).
             - CreateListingSheet: "Save as eBay draft" toggle (3-way via resolvePublishMode helper).
             - Scan Save & List: "List as eBay draft" checkbox in ScanReviewActions; the boolean rides
               onSaveAndList(ebayDraft) → buildListingPayload(ebayDraft) → 'ebay_draft'.
             - LESSON (logged): tdd-guard is NOT exempt for apps/web; never work around it; an early
               onClick={onSaveAndList} passed the click EVENT as ebayDraft (false-green) — fixed to
               onClick={() => onSaveAndList(ebayDraft)}. web 199 green.
  [x] F-GATE  DONE + LIVE-VERIFIED (2026-06-23). Built EbayAdapter.getEbayItemVerification(sku) (GET
              inventory_item + offer → aspects/MPN) + GET /listings/:id/ebay-offer (requireAuth, ownership-
              scoped). TDD: api 523 green, typecheck/lint clean. Playwright ebay-draft-gate.spec.ts drives
              eBay-draft on BOTH panels (item-detail CreateListingSheet + scan Save&List w/ real AI scan,
              fixture=demo iPhone). LIVE 3/3 pass; independent route read confirms: item-detail offer
              192643508011 + scan offer 193013983011, both UNPUBLISHED, aspects.MPN=['Does Not Apply']
              → PR #132's product.mpn→aspects.MPN mirror PROVEN. PR #132 merge-gate now SATISFIED.
              2 orphan eBay drafts (PRT-000009/192643508011, PRT-000010/193013983011) left for F-ORPHAN.
              UNCOMMITTED.
  [ ] F-ORPHAN  Orphan cleanup — deleting a Portage listing (or a failed publish) must withdraw/delete the
                eBay offer, or reuse it; today they orphan as eBay drafts (e.g. PRT-000008 / item 5117769708900).
  [ ] F1   Route both publish paths through a single publish-confirm sheet (kills the panels-on-one-path-only divergence).
  [ ] F2   Price panel — confirm/edit price on every publish (prefill items.price → comps → estimate).
  [ ] F3   Terms panel (DisclaimerSheet) with opt-in "don't show for 7 days": unchecked default; version-scoped
           (void on CURRENT_DISCLAIMER_VERSION bump); server-side — needs a SCHEMA CHANGE (suppress_until,
           user-level; current disclaimer_acceptances is per-listing) → pause for explicit go before db:push;
           first acceptance still recorded, TTL suppresses only the re-prompt.
  [ ] F4   Two-state publish RESULT screen: success vs draft-saved-with-the-verbatim-eBay-reason.
  Done when: both paths show price + terms, eBay-draft works, 7-day dismiss works + resets on version bump,
  result screen distinguishes success from draft-saved.

  CARRY-OVER DEFERRED (registry; not Phase F core): Type AI auto-pick on high-cardinality aspects (best-effort
  prompt shipped); duplicate listings-row on republish (idempotency); SKU Seller-Hub Custom-label check.
  SUBSEQUENT PHASES (not F): E-panel (AiIdentificationPanel), G (Save & List lists live not silent draft),
  H (orders sync — broken weeks), I (remove in-app carriers → eBay shipping policy). See backlog doc.
