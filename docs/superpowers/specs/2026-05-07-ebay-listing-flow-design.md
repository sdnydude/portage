# Multi-Marketplace Listing Flow Design

**Date:** 2026-05-07
**Approach:** Minimal — close the frontend gaps, add Reverb adapter, use existing backend CRUD
**Scope:** Item detail → listing creation (eBay + Reverb) with comps → listing detail page (view/edit/end)

---

## Problem

Users can create and publish eBay listings via the API, but the frontend flow is broken:
- `/listings/[id]` returns 404 — no way to view, edit, or end a listing after creation
- The create listing sheet has no pricing context (comps exist but aren't surfaced)
- No clear entry point from the item detail page to list on marketplaces
- Reverb (music gear marketplace) is not supported despite fitting the existing adapter pattern

## Solution

Four connected pieces:

1. "List" button on item detail page with marketplace selector
2. Enhanced create listing sheet with inline comps
3. New listing detail page with view/edit/end (marketplace-agnostic)
4. Reverb marketplace adapter

---

## 1. Item Detail Page — "List" Entry Point

**File:** `apps/web/src/app/inventory/[id]/page.tsx`

Add a button in the action area:
- **No active listing:** "List for Sale" button → opens enhanced create listing sheet with marketplace selector
- **Has active listing(s):** "View Listing" button → navigates to `/listings/[id]` (if multiple, shows a list)

Determination: call `GET /api/listings?itemId=X` for active listings across all marketplaces.

---

## 2. Enhanced Create Listing Sheet

**File:** `apps/web/src/components/listing/create-listing-sheet.tsx`

### Marketplace Selector

Pill toggle at top of sheet: **eBay** | **Reverb** | **Etsy** (Etsy disabled/coming soon).

Selection determines which adapter handles the listing and which marketplace-specific fields appear.

### Comps Summary Block

- Fetches via `useComps(itemId)` on sheet open (eBay Browse API — works for general pricing context regardless of target marketplace)
- Displays:
  - "Based on X sold listings" — median sold price, price range (low–high)
  - "Y active listings" — median active price
- Compact: 3 lines max
- Loading skeleton while fetching
- Graceful fallback: "No comparable listings found" if no comps

### Pre-filled Fields

| Field | Pre-fill source | eBay | Reverb |
|-------|----------------|------|--------|
| Price | Comps sold median (rounded to nearest dollar) | Yes | Yes |
| Title | Item title from AI scan | Yes | Yes |
| Description | Item description from AI scan | Yes | Yes |
| Category | Taxonomy API / categories API suggestion | eBay Taxonomy | Reverb `/api/categories/flat` |
| Condition | Item condition field if set during scan | 5 eBay conditions | Reverb `/api/listing_conditions` |

### Marketplace-Specific Fields

**eBay only:** (none beyond the common fields for v1)

**Reverb only:**
- Make (manufacturer) — required, pre-fill from AI scan
- Model — required, pre-fill from AI scan
- Finish — optional
- Year — optional, accepts "1960s", ranges like "1979-1981", or specific years
- Offers enabled — toggle (default: true)

### Condition Selector

Dynamic per marketplace:
- **eBay:** Dropdown with 5 conditions: New, Like New, Very Good, Good, Acceptable
- **Reverb:** Fetched from `/api/listing_conditions` on first Reverb selection (cached)

### Publish Flow

User reviews/adjusts → taps "Publish" → `POST /api/listings` with `marketplace: 'ebay' | 'reverb'` → backend routes to correct adapter → on success, redirect to `/listings/[id]`.

---

## 3. Listing Detail Page

**New file:** `apps/web/src/app/listings/[id]/page.tsx`

### Layout (mobile-first, single scroll)

1. **Status banner** — color-coded pill + marketplace badge:
   - Active: green
   - Draft: amber
   - Ended: gray
   - Sold: blue
   - Marketplace icon/name shown alongside status

2. **Item preview** — thumbnail, title, description from linked inventory item

3. **Listing details card** — tap-to-edit fields (no separate edit mode; all changes collected and saved with one "Save Changes" button):
   - Price (editable)
   - Title (editable)
   - Description (editable)
   - Category (read-only, shows path)
   - Condition (read-only)
   - SKU (read-only)
   - Marketplace listing ID (external link to live listing page)
   - Published date

4. **Actions:**
   - "Save Changes" — `PATCH /api/listings/:id` → routes to correct adapter's `updateListing()`
   - "End Listing" — confirmation dialog → `DELETE /api/listings/:id` → routes to correct adapter's `deleteListing()`
   - "View on [Marketplace]" — external link (eBay listing page or Reverb listing page)

### Status Sync on Load

Page load calls `getListingStatus()` on the correct adapter to sync before rendering. Catches status changes made outside Portage. If sync fails, returns local data with `synced: false` flag — UI shows a warning badge.

---

## 4. Reverb Marketplace Adapter

**New file:** `apps/api/src/marketplace/reverb-adapter.ts`

Implements the `MarketplaceAdapter` interface.

### Authentication

Reverb uses personal API tokens (no OAuth dance, no expiry, no refresh). Token stored encrypted in `marketplace_accounts` table like eBay/Etsy tokens.

**New file:** `apps/api/src/routes/marketplace/reverb-auth.ts`
- `POST /connect` — accepts token from user, validates via `GET /api/my/account` on Reverb, stores encrypted
- `GET /status` — checks if token is stored and valid
- `DELETE /disconnect` — removes stored token

### API Details

| Header | Value |
|--------|-------|
| `Content-Type` | `application/hal+json` |
| `Accept` | `application/hal+json` |
| `Accept-Version` | `3.0` |
| `Authorization` | `Bearer {personal_token}` |

**Base URLs:**
- Production: `https://api.reverb.com`
- Sandbox: `https://sandbox.reverb.com`

### Adapter Methods

| Method | Reverb API Call | Notes |
|--------|----------------|-------|
| `createListing()` | `POST /api/listings` | Single call (vs eBay's 3-step) |
| `updateListing()` | `PUT /api/listings/{id}` | Full update |
| `deleteListing()` | `DELETE /api/listings/{id}` | End listing |
| `getListingStatus()` | `GET /api/listings/{id}` | Check current state |
| `getOrders()` | `GET /api/my/orders/selling/all` | Date-range filter |
| `searchCategories()` | `GET /api/categories/flat` | Flat list, cached |

### Env Var

`REVERB_SANDBOX=true` — toggles base URL between production and sandbox.

Token stored per-user in DB (not env var), entered via a "Connect Reverb" flow in the settings/marketplace page.

---

## 5. Schema & Type Changes

### Database (Drizzle schema push required)

**File:** `apps/api/src/db/schema.ts`

```
marketplaceEnum: ['ebay', 'etsy'] → ['ebay', 'etsy', 'reverb']
```

This is a Drizzle schema push (`npm run db:push`). Adding a value to a PostgreSQL enum is non-destructive — no data migration needed.

### Shared Types

**File:** `packages/shared/src/types.ts`

All `'ebay' | 'etsy'` union types → `'ebay' | 'etsy' | 'reverb'`:
- `Listing.marketplace`
- `Order.marketplace`
- `MarketplaceAccount.marketplace`

### Listings Route

**File:** `apps/api/src/routes/listings.ts`

- Add `'reverb'` to the `marketplace` enum in `createListingSchema`
- Add `case 'reverb': return new ReverbAdapter(userId)` to `getAdapter()`

---

## 6. Data Flow & API Surface

Existing endpoints handle all marketplaces — the `marketplace` field on the listing routes to the correct adapter:

| Action | Frontend | API Call | Backend |
|--------|----------|----------|---------|
| Fetch comps | `useComps(itemId)` | `GET /items/:id/comps` | `EbayAdapter.searchComps()` (eBay Browse API) |
| Create listing | Sheet submit | `POST /api/listings` | Adapter determined by `marketplace` field |
| View listing | Page load | `GET /api/listings/:id` | DB fetch + adapter `getListingStatus()` sync |
| Edit listing | Inline save | `PATCH /api/listings/:id` | Adapter `updateListing()` |
| End listing | Confirm dialog | `DELETE /api/listings/:id` | Adapter `deleteListing()` |

### Backend Tweak

`GET /api/listings/:id` handler adds a `getListingStatus()` call (routed to correct adapter) before returning to sync with the marketplace. If sync fails (network error, expired token), return local data with `synced: false`.

### Hook Changes

`useListings` hook gains two methods:
- `getListing(id)` — fetch single listing with sync
- `updateListing(id, changes)` — PATCH and refresh local state

---

## 7. Error Handling & Edge Cases

### Token Issues
- **eBay:** `token-manager.ts` refreshes with 5-minute buffer. If refresh fails, surface "Reconnect eBay" prompt.
- **Reverb:** Tokens don't expire. If a 401 is returned, the token was revoked — surface "Reconnect Reverb" prompt.
- Never silently fail on auth errors.

### Marketplace Status Drift
Listing removed or sold outside Portage. Page-load sync catches this — if marketplace returns 404 or unexpected status, update local DB and show real status. No stale "Active" badges.

### Comps Unavailable
Browse API rate-limited or no results. Create sheet still works — comps section shows "No comps available", price field has no pre-fill. User sets price manually. Not a blocker. (Comps are eBay-sourced; still useful as pricing context for Reverb listings.)

### Publish Failure
- **eBay:** Rejects listing (missing specifics, policy violation). Adapter falls back to draft. Show error in toast, redirect to listing detail page in "Draft" status.
- **Reverb:** Returns error with specific field validation messages. Show in toast, keep sheet open for correction.

### Concurrent Edits
Single-user app (personal inventory). No optimistic locking needed.

---

## 8. Deployment Notes

### Prerequisites
- eBay sandbox OAuth must be working (RuName `Digital_Harmony-DigitalH-click2-foacuzhy` configured, `EBAY_REDIRECT_URI` set to RuName in Doppler dev)
- Reverb personal API token from reverb.com/my/api_settings (or sandbox.reverb.com for testing)

### Deploy Steps
1. `npm run db:push` — adds `'reverb'` to marketplace enum (non-destructive)
2. `npm run build -w packages/shared` — rebuild shared types
3. Restart API to pick up new adapter and route
4. Add `REVERB_SANDBOX=true` to Doppler dev environment
5. Frontend deploys automatically with the new pages

### What's NOT in This Spec
- Camera/scan improvements (works as-is, separate concern)
- Scan FAB (TODO item, separate spec)
- Bulk listing operations (future)
- Etsy listing flow (same adapter pattern, separate spec)
- Promoted Listings / Marketing API (future)
- Reverb comps (would need Reverb search API — eBay comps serve as general pricing context for now)

---

## Files to Create/Modify

| Action | File |
|--------|------|
| **Create** | `apps/web/src/app/listings/[id]/page.tsx` |
| **Create** | `apps/api/src/marketplace/reverb-adapter.ts` |
| **Create** | `apps/api/src/routes/marketplace/reverb-auth.ts` |
| **Modify** | `apps/web/src/app/inventory/[id]/page.tsx` (add "List for Sale" button) |
| **Modify** | `apps/web/src/components/listing/create-listing-sheet.tsx` (comps, marketplace selector, Reverb fields) |
| **Modify** | `apps/web/src/hooks/use-listings.ts` (add getListing, updateListing) |
| **Modify** | `apps/api/src/routes/listings.ts` (add sync on GET /:id, add reverb to adapter factory) |
| **Modify** | `apps/api/src/db/schema.ts` (add 'reverb' to marketplaceEnum) |
| **Modify** | `packages/shared/src/types.ts` (add 'reverb' to marketplace unions) |
| **Modify** | `apps/api/src/lib/env.ts` (add REVERB_SANDBOX) |
| **Modify** | `apps/api/src/index.ts` (mount reverb-auth router) |
