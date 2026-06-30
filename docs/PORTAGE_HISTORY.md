# Portage — Development History & Burndown Detail

_Compiled 2026-06-24 from git history (668 commits), auto-memory, the DHG Registry KB (ship sessions, decisions, bug fixes, corrections, deferred items, insights), and the codebase. Companion to the registry burndown list `e0c6e2ae-0ec8-4360-9192-963934efa887` (interactive view at `http://10.0.0.251:8011/api/burndown-lists/e0c6e2ae-0ec8-4360-9192-963934efa887/view`)._

Portage is an AI-powered personal-effects inventory and multi-marketplace seller app (eBay, Etsy, Reverb). npm-workspaces monorepo: `apps/api` (Express 5 + Drizzle + PostgreSQL), `apps/web` (Next.js 16 / React 19), `packages/shared` (types). Owner: Stephen Webber / Digital Harmony Group. Server: g700data1 (10.0.0.251).

**Span:** 2026-04-24 → 2026-06-23 (~2 months). **Commits:** 668 (sdnydude 546, web UI 76, dependabot 47). **~70 merged PRs.** **Tests:** 0 → 531 api / 213 web.

---

## 1. Timeline of phases

| Window | Epic | Refs |
|---|---|---|
| 04-24 | **Foundation MVP** — full stack landed in one 105-file / 23k-line squash | `b363d24` |
| 04-24–25 | CI/Dependabot; shipping, Apple-Glass design tokens, dashboard, Ship-It flow | PRs #2–24 |
| 05-08 | **Three-interface listing flow** + Smart Listing Prepare | PR #25 |
| 05-09 | Scan pipeline accuracy fixes; **Listings CRUD** | PRs #26–27 |
| 05-09 | **Security C1–C4** (XSS, SQLi, order-sync, encryption-key) | PRs #28–31 |
| 05-09–10 | JWT auto-refresh, object-URL leaks, **test infrastructure** | PRs #32–36 |
| 05-10 | **Code-quality refactors** (logger, AI singletons, format, components) | PRs #37–44 |
| 05-10 | PWA, Admin observability, Bulk ops, eBay CSV, Onboarding | PRs #45–50 |
| 05-10 | **Unified multi-photo scan flow** | PR #52 |
| 05-14 | **WebP → JPEG** image pipeline | PR #63 |
| 05-15 | **Code health week 1** (37 findings) | PRs #65–66 |
| 05-16–17 | Memory/registry intelligence pipeline; **Stripe billing**; Reverb auth | PRs #67–79 |
| 05-24 | **eBay buyer messaging** (Trading API) | PR #84 |
| 05-26–27 | **Porter voice chat** + home redesign; bulk photo export | PRs #87–88 |
| 06-03–04 | **eBay production OAuth**; **eBay listing hardening** (20-task sprint) | PRs #93–94 |
| 06-05 | **Frontend E2E enforcement harness** | PR #97 |
| 06-05–08 | Post-hardening eBay live fixes (self-heal category/location/policies) | PR #101 |
| 06-09–10 | **DHG redesign** Ship 1 + Stages 1 / 2 / 2.5 | PRs #102–108 |
| 06-11 | Per-session auth; Pre-Stage-3 fix batch A/B/C | PRs #110–112 |
| 06-17–19 | eBay category persistence + **ATO hardening** | PRs #116–119 |
| 06-23 | **AI-specifics A–E** (scan→persist→publish carry-through) | PR #132 (merged) |
| 06-23 | **Phase F** — publish unification (F0–F4) | branch `feat/phase-f-publish-unification` |

---

## 2. Major refactors

- **Shared logger** (PR #39) — 26 standalone `pino()` instances → one root + `createLogger()` children, for central level/transport control.
- **AI SDK singletons** (PR #40) — per-call `new Anthropic()/new OpenAI()` → lazy `Map`-keyed singletons across 5 providers.
- **Format helpers + listing-flow component extraction** (PRs #43–44) — pulled `ShippingConfigCard`, `PricingStrategyPicker`, `PhotoCaptureOverlay` out of the three god-file flows.
- **eBay adapter 20-task hardening** (PR #94) — quantity/SKU/publishMode columns, condition→enum mapping, offer reuse, policy/location auto-setup, bulk publish.
- **Provider-chain abstraction** — `chatStream()`→`chatChain()` with fallback; `VISION_PROVIDERS`/`CHAT_PROVIDERS` env chains (local→gemini→anthropic).
- **Photo-edit unification** (PR #108) — `usePhotoEdit` hook + `PhotoEditPanel` replace ad-hoc photo UI across every flow; legacy `PhotoEditor` deleted.
- **Publish-path unification** (Phase F) — `CreateListingSheet` became the single confirm sheet for both publish entry points.

---

## 3. Redesigns

- **Apple-Glass → DHG design system** (06-09) — forest-green `#2D5A27` + amber remapped to graphite `#2D2A26` / orange `#F77E2D` / deep-teal `#0D7377`; Instrument Sans + Plus Jakarta Sans. Purple explicitly rejected ("overused in AI branding"). Pre-remap palette saved as a revert source.
- **Tab bar** — three iterations, ending at 6 destinations (Home/Inventory/Listings/Porter/Orders/More) with center Scan FAB.
- **Porter home** — graphite hero, push-to-talk FAB, comps search, theme toggle, AI-confidence chips.
- **Scan-review (Stage 1)** — inline eBay item-specifics at scan time, dynamic condition constraining, eBay taxonomy as THE category.
- **Pricing engine (Stage 2)** — R-7 percentile bands from one comp pool, Best-Offer auto-accept, publish-time listing footer.
- **Photo gallery (Stage 2.5)** — unified strip + full-screen editor overlay across all surfaces.

---

## 4. Major blockers & their solutions (debugging history)

The hardest problems and how they were solved — the core of this project's institutional knowledge.

### Marketplace / eBay
- **WebP rejected by all marketplaces** → switch Sharp output to JPEG; keep PNG only for alpha (BG-removal). (PR #63)
- **BrandMPN error 25002** — eBay requires `product.mpn` whenever `brand` is set → send `"Does Not Apply"` sentinel when there's no real part number; never the model name. (`12ad270`)
- **Offer-already-exists 25002 (overloaded id)** — match on the message text, look up the existing offer by SKU, reuse its `offerId`. (`24d4f9f`)
- **Accept-Language 25709 / packageType 25101 / globalShipping 20403 / location 25802** — header + payload-shape fixes against eBay's strict Inventory API.
- **CALCULATED shipping rejected in sandbox** → FLAT_RATE+USPSPriority first, Calculated re-enabled later with USPSParcel + migration.
- **Trading API 10012 / orders 30800** — missing `X-EBAY-API-COMPATIBILITY-LEVEL` header; malformed `creationdate:[..}` bracket. (`d08d7c7`)
- **eBay ATO account lock (25019)** — four hypotheses refuted (signatures, env, marketplace-id, IP/geo). Real app-side signals were **SKU/offer churn** on a new account and **anonymous requests**. Fixes: stable per-item `PRT-` SKU via a Postgres sequence + descriptive `User-Agent` on every eBay call. (PRs #116/118) The key insight, corrected 2026-06-20: user-IP ≠ server-egress-IP is **normal** for every third-party eBay app — the egress must stay direct/residential/static, never proxied.
- **Disclaimer consent never recorded** — the unified sheet showed terms but no row was written; the orphaned `accept-terms` endpoint 404'd (no listing exists at accept time) and was fed an `itemId` as `listingId`. Fix (F3a): record `disclaimer_acceptances` against the real new listing id on live publish, version stamped server-side.
- **Orphaned eBay offers** — deleting an `ebay_draft` left the unpublished offer in Seller Hub (delete only withdrew `active` listings). Fix (F-ORPHAN): withdraw by `ebayOfferId` for drafts, best-effort.

### Vision / AI
- **Gemini vision 502** — reasoning tokens exhausted `max_tokens`, truncating JSON → set `reasoning_effort:'none'` on Gemini vision; added `provider:model` chain syntax.
- **Scan-time aspect prefill empty `{}`** — text-only path (no image) hit a broken Ollama JSON path → thread the in-memory scan image through `generateListingFields`.

### Frontend / mobile
- **iOS WebKit `aspect-ratio` collapses to 0px** in flex+overflow → use the `paddingBottom:100%` trick. (recurred in BeforeAfterSlider and ScanFlow)
- **`crypto.randomUUID` undefined on plain-HTTP LAN** — secure-context-only API threw at top-level load and silently killed all handlers → portable `uuid()` fallback.
- **`resetEnhance()` in an error `useEffect`** nuked results on mobile → remove reset from error effects.
- **Controlled `type=number` price field couldn't delete the first digit** → local raw-text state + `type=text inputMode=decimal`.

### Infra / config / tooling
- **3-file `.env` shadowing** — `apps/*/.env` stale copies won via dotenv no-override → deleted them; container uses root `env_file`.
- **`z.coerce.boolean("false") === true`** → `EBAY_SANDBOX="false"` silently meant sandbox-on → `.transform(v => v.toLowerCase() !== 'false')`.
- **drizzle-kit push from host must target `127.0.0.1:5436`** — `portage-db` binds localhost-only; `10.0.0.251` is refused.
- **RTX 5080 (Blackwell) PyTorch incompatibility** — `dhg-stt`/`dhg-tts` run on CPU until ML images ship sm_120 kernels.
- **CI live-rebuild took prod down ~2 min** → isolated ephemeral e2e stack (ports 5998/8998/3998), never touches live.
- **tdd-guard crashed (blocked all edits)** — `VALIDATION_CLIENT=sdk` returned prose; pinned model EOL'd → 404 fail-closed → fix to `VALIDATION_CLIENT=api` + `TDD_GUARD_MODEL_VERSION=claude-sonnet-4-6` in Doppler. Plus a friction playbook (stub-first, one-test-at-a-time, small edits, `toEqual` for cohesive objects).

---

## 5. Security & quality milestones

- **C1–C4** (PRs #28–31): order-sync match by `marketplaceListingId`; `dangerouslySetInnerHTML` → React elements; `sql.raw()` → parameterized Drizzle; AES-256-GCM key decoupled from `JWT_SECRET`.
- **Auth middleware** `next(err)` (Express 5); shipping-preset **TOCTOU** fixed with transaction + partial unique index.
- **Code health week 1** (PRs #65–66): ILIKE escape, password policy, money precision as integers, indexes/FK cascades, rate limiting, admin guards, 3.8k lines of dead mockup removed.
- **Per-session auth** (PR #110): `refresh_tokens` table ends mutual device revocation; stay-logged-in; admin revoke-all.
- **Frontend E2E gate** (PR #97): committed Playwright spec rebuilds `portage-app`, drives `:3002`, asserts persistence via reload; enforced by local hook + CI + branch protection.

---

## 6. Portage ↔ DHG AIFactory infra integration

Product-wise Portage is standalone, but it shares the g700data1 server and several DHG services. **Key fact:** the Portage *app* has zero runtime coupling to the DHG Registry — all registry I/O lives in the Claude Code tooling layer.

- **DHG Registry KB** (`10.0.0.251:8011`) — Portage's Claude Code sessions auto-post 8 data types via `~/.claude/scripts/` shims → `memreg_capture.py`: `insights`, `decisions`, `ship_sessions`, `bug_fixes`, `corrections`, `deferred_items`, `test_coverage`, `agent_sessions`. Behavioral triggers live in `.claude/rules/auto-*.md`; a Stop-hook `capture-guarantee.py` backfills anything missed. Read back via the KB-search rule and the SessionStart **briefing** (recent sessions, ship sessions, correction patterns, bug-fix RCAs). Also hosts `doc_pages` (Docusaurus chunks, hybrid RRF search) and the **burndown lists** (this document's companion).
- **Network bridge** — `portage-api` is the *only* container on both `portage-network` and the AI Factory's `dhg-network`, which is how it reaches the registry by name. `portage-app`/`portage-db`/`dhg-stt`/`dhg-tts` stay on `portage-network`.
- **Shared GPU/AI services** — `dhg-stt` (Whisper large-v3-turbo, :8018) and `dhg-tts` (Chatterbox Turbo, :8019) power Porter voice; both currently CPU-bound (Blackwell). Vision/chat use the provider chain (Gemini 2.5 primary, Claude fallback).
- **Secrets & infra** — Doppler (8 DHG projects; `.env` regenerated each SessionStart); Cloudflare R2 (`portage-images` bucket) + tunnel (`portage.digitalharmonyai.com`); docs served by the AI Factory's `dhg-docs` nginx (:8017), built+ingested by a **self-hosted GitHub Actions runner** on push to `website/**`.
- **Server topology** — portage-db:5436 (loopback), portage-api:8016, portage-app:3002, portage-rembg:7000 (server-side BG-removal fallback), dhg-stt:8018, dhg-tts:8019, dhg-docs:8017, registry:8011.
- **Decision rationale** (registry): Doppler chosen over self-hosted Vault/Infisical ("self-hosted infra rots when the operator is the CEO"); local nginx docs over GitHub Pages (needs local registry ingest); self-hosted runner over file-watchers.

---

## 7. Open backlog (not done)

See the burndown list for status + urgency. Highest-urgency open items:

- **critical** — Phase H: orders sync broken for weeks (root cause unconfirmed).
- **high** — open + merge the Phase F PR to main (F0–F4 are all on `origin/feat/phase-f-publish-unification` tip `37a0d9b`); ship the `/about` page (F3b microcopy links to it and it doesn't exist yet). _(Note: F4 is on the branch — pushed; the local checkout at `9309dc7` is merely 2 commits behind and fast-forwards cleanly.)_
- **medium** — Phase G (Save & List should publish live, not silent draft); Phase I (remove in-app carriers → eBay shipping policy); Phase E-panel; Stage 3 eBay-setup nav trap; duplicate-listings-row idempotency; review the two authorized tdd-guard bypass diffs; eBay Business-Policies opt-in Tasks 2–3; Etsy wiring + OAuth callback.
- **low** — DisclaimerSheet `listingId` prop cleanup; dead-end/unwired-artifact audit (~604 orphan nodes); export-tokens cleanup, aspect cache, DB-backed OAuth state, export row limit.
