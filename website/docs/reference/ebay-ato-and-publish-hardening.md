---
id: ebay-ato-and-publish-hardening
title: eBay ATO & Publish Hardening
sidebar_position: 1
---

# eBay Account Security (ATO) & Publish Hardening

:::warning Partially superseded — Trade-First migration
The publish-path sections below ("SKU / offer churn", the offer-related hardening rows, and the publish error-code table) describe the pre-migration **Inventory API** path, superseded by the Trade-First migration (PR #133, merged 2026-06-30) — for current publish behavior see [eBay Trade-First Publishing](/docs/reference/ebay-trade-first) (adapter context: [Marketplace Adapters](/docs/architecture/marketplace-adapters)).
The **ATO threat model**, the **serialized-SKU pattern**, and the **`User-Agent` hardening** remain current.
:::

Reference for eBay's **Account-Takeover (ATO) protection** as it affects API publishing
from Portage, the signals we control, and the hardening shipped in PR #118. Written
2026-06-19 from primary eBay sources and live verification — claims we could **not**
confirm are marked as such.

## The symptom

eBay placed an account-level **ATO_TASR** lock (Account-Takeover / Temporary Account
Security Restriction) that blocks selling entirely and **re-fired on publish**: lift the
lock → publish from the app → re-locked, reproducibly.

The app surfaces it as eBay **errorId 25019**:

> *"Cannot revise listing. The item cannot be listed or modified. The title and/or
> description may contain improper words, or the listing or seller may be in violation
> of eBay policy."*

That text is a **generic wrapper** — the "improper words" branch is a red herring. The
real cause is the account-level security restriction. eBay's API does not expose the ATO
reason directly; 25019 is what comes back on the wire.

## What it is NOT — hypotheses refuted against primary sources

Four plausible causes were investigated and **ruled out**, each against an authoritative
source rather than a guess:

| Hypothesis | Verdict | Evidence |
|---|---|---|
| Missing **digital signatures** | Refuted | eBay **Key Management API** spec: signing is required only for **EU/UK sellers** and only on **Finances API, `issueRefund`, `GetAccount`, Post-Order refunds** — *not* the Inventory API publish path. Portage is a **US (`EBAY_US`)** seller. |
| **Env / token mismatch** (sandbox vs prod) | Refuted | `EBAY_SANDBOX="false"` — token refresh and publish both hit `api.ebay.com`. Consistent. |
| Missing **marketplace-id** header | Refuted | `X-EBAY-C-MARKETPLACE-ID: EBAY_US` is present on every Sell call. |
| **IP / geo mismatch** | Refuted | Server egress is `209.42.32.216` — **OPTICALTEL** (residential consumer ISP, Fort Lauderdale FL), `hosting:false`, `proxy:false`. That is the **best** IP class for ATO; routing through a Cloudflare/datacenter egress would be *worse* (`hosting:true` ranges are weighted higher-risk by fraud systems). See [decision: keep direct residential egress]. |

> **Networking note:** eBay API calls go **direct** from the server's outbound IP
> (`ebay-adapter.ts` → plain `fetch('https://api.ebay.com/…')`). The Cloudflare Tunnel
> fronting `portage.digitalharmonyai.com` carries **inbound** traffic only (plus the
> OAuth callback); it has no role in outbound API calls. A forward proxy would not help —
> the server already exits via a residential IP.

## What it IS — the app-side signals we control

eBay's ATO protection is documented to trigger on, among other things, **rapid listing
frequency** and requests that **look automated**. Two such signals existed in Portage and
are the focus of the fix:

### 1. SKU / offer churn (rapid listing frequency)

The eBay adapter minted a **fresh random SKU** (`portage-${Date.now()}-${random}`) on every
publish and only persisted it on success. A publish that failed *after* creating the
inventory item + offer (e.g. when the lock fired at the publish step) left **no persisted
SKU**, so the next attempt minted a *new* one → a **new `inventory_item` + offer** on each
retry. A burst of new SKUs/offers in minutes is exactly the "rapid listing" pattern ATO
keys on, and it matched the reproducible re-lock.

### 2. Anonymous requests (look like a bot)

Node's `fetch` sends **no `User-Agent`**. To eBay's bot/ATO layer a selling-API call from
an unidentified client reads as a script.

## The hardening (PR #118)

| Fix | File | Effect |
|---|---|---|
| **Stable serialized SKU** | `ebay-sku.ts`, `schema.ts` | `items.ebaySku` (`PRT-000123`) minted **once per item** from `portage_ebay_sku_seq` and reused on every publish — eBay's `inventory_item` PUT stays idempotent, so retries never churn a second item. |
| **Atomic mint** | `ebay-sku.ts` | Single `UPDATE … SET ebay_sku = COALESCE(ebay_sku, 'PRT-'\|\|lpad(nextval(…),6,'0')) RETURNING` — per-row serialization means two concurrent publishes converge on one SKU (a read-then-write could race into two). |
| **Publish prefers the listing's own SKU** | `listings.ts` | `listing.ebaySku ?? ensureItemEbaySku(item)` — never override a SKU an existing offer is already bound to (would orphan a freshly-PUT inventory item). |
| **Idempotent offer** | `ebay-adapter.ts` | On eBay **25002 "offer already exists"**, look the offer up by SKU and **reuse** it instead of failing or duplicating. Lazy — only fires on the 25002 recovery, not the happy path. |
| **`User-Agent` on every call** | `ebay-constants.ts` | `PortageApp/1.0 (+https://portage.digitalharmonyai.com)` on all eBay API + OAuth requests. |
| **`PATCH /items` merge** | `items.ts` | Read-merge `marketplaceData` so a category-only edit doesn't null the AI title or wipe sibling-marketplace cache (data-loss bug exposed by the category-persist work). |

## What this does and does not fix

- **Does:** removes the app-side automation/rapid-creation signals eBay's ATO system can
  see, and prevents the orphaned-inventory churn entirely.
- **Does not:** lift the lock. **ATO_TASR is an account-level security action** — only the
  account holder clears it (eBay's security verification / Trust & Safety). Until then,
  every publish fails regardless of code.

> **Unverified:** we have **no eBay confirmation** that SKU churn + anonymous fetch were
> *the* cause of this specific lock — they are the documented signals we control and the
> behaviors that matched the reproduction. The definitive cause sits with eBay. End-to-end
> publish cannot be validated until the lock is lifted.

## eBay error codes seen on the publish path

| errorId | Meaning | Handling |
|---|---|---|
| 25019 | Generic "cannot revise listing" — here, the ATO wrapper | Surface honestly; do not blame the title |
| 25002 | "An offer entity already exists for SKU" | Reuse the existing offer (idempotent-offer recovery) |
| 25020 | Calculated shipping needs weight + dimensions | Pre-flight `EbayWeightRequiredError` (422) |
| 25021 | Condition invalid for the category | Per-category condition auto-correct |
| 25709 | Missing/invalid `Accept-Language` | `Accept-Language: en-US` on Inventory calls |

## Sources

Primary eBay + Cloudflare research (eBay Request Headers, Key Management API spec,
Finding Categories, Account API; Cloudflare ATO / tunnel docs) was collected 2026-06-17
into a local research folder that was removed from the repo in the 2026-07 docs refresh —
the originals remain on eBay's and Cloudflare's developer sites. The ATO-cause refutations
above were checked against the eBay **Key Management API** OpenAPI spec and the
**Request Headers** developer doc directly, not the AI-generated research summaries that
accompanied them (one of which incorrectly assumed outbound traffic traverses the tunnel).
