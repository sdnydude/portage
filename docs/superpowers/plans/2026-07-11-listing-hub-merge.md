# Listing Hub Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the listing detail page into the item detail page — `inventory/[id]` becomes the single canonical detail page with a "Marketplace Listings" card section; `listings/[id]` becomes a redirect.

**Architecture:** One item → N listing cards. Item-level data (photos, description, condition, comps) stays as-is on `inventory/[id]`; each listing row renders as a self-contained `ListingCard` carrying all per-listing state and actions (price edit, publish with aspect/weight recovery sheets, archive, delete, relist, GTC date, marketplace link). The listings tab deep-links to `/inventory/[itemId]?listing=[listingId]` which scrolls to and highlights the card. The old `listings/[id]` route resolves its listing's itemId and redirects.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`@theme` in globals.css), Vitest + React Testing Library (co-located `.test.tsx`), Express 5 + Drizzle (API), zod.

## Global Constraints

- Mobile-first at 375px; DHG design system tokens (teal `var(--teal)`, existing pill/card patterns in the two source pages — match them, don't invent new ones)
- tdd-guard is active: test must be written and observed failing (`npm run test -w apps/web` / `-w apps/api`) before implementation edits
- Containers are image-baked: deploy = `docker compose up -d --build portage-api` / `portage-app`; verification against `https://10.0.0.251:3002` (dev) or prod
- All components `"use client"`; hooks return `{ isLoading, error, ...data }`
- API route bodies: `try { ... } catch (err) { next(err) }`; zod-validate all inputs
- Each task is one PR off `main` (`git merge --no-ff` via PR); conventional commits, subject ≤72 chars, no co-author trailers
- Reference sources: `apps/web/src/app/listings/[id]/page.tsx` (851 lines, the page being absorbed) and `apps/web/src/app/inventory/[id]/page.tsx` (782 lines, the host page)

---

### Task 1 (PR 1): API — `itemId` filter on GET /listings

**Files:**
- Modify: `apps/api/src/routes/listings.ts:199-204` (listQuerySchema) and the `GET /` handler conditions block (~line 282)
- Test: `apps/api/src/routes/listings.test.ts`

**Interfaces:**
- Consumes: existing `listQuerySchema`, `conditions` array pattern in `GET /`
- Produces: `GET /listings?itemId=<uuid>` returns only that item's listings (still user-scoped). Later tasks rely on this exact query param name: `itemId`.

- [ ] **Step 1: Write the failing tests** — in `listings.test.ts`, alongside the existing GET /listings tests (reuse that file's mock helpers):

```typescript
it('filters by itemId when provided', async () => {
  mockSelectForList([], [{ count: '0' }]); // reuse the file's existing list-mock helper
  const res = await request(app)
    .get('/listings?itemId=c19d41df-6807-4efc-8436-ea5289f4c4fa')
    .set('Authorization', `Bearer ${authToken}`);
  expect(res.status).toBe(200);
});

it('rejects a non-uuid itemId with 400', async () => {
  const res = await request(app)
    .get('/listings?itemId=not-a-uuid')
    .set('Authorization', `Bearer ${authToken}`);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -w apps/api -- src/routes/listings.test.ts`
Expected: the 400 test FAILS (schema currently ignores unknown `itemId`, returns 200).

- [ ] **Step 3: Implement** — in `listings.ts`:

```typescript
const listQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'sold', 'archived']).optional(),
  marketplace: z.enum(['ebay', 'reverb']).optional(),
  itemId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
```

and in the `GET /` handler after the existing marketplace condition:

```typescript
    if (query.itemId) conditions.push(eq(listings.itemId, query.itemId));
```

- [ ] **Step 4: Run tests** — `npm run test -w apps/api -- src/routes/listings.test.ts` → all pass; then full `npm run test:api` + `npm run typecheck`.

- [ ] **Step 5: Commit** — `fix(api): support itemId filter on GET /listings`

---

### Task 2 (PR 2): Read-only Marketplace Listings section on item detail

**Files:**
- Modify: `apps/web/src/hooks/use-listings.ts` (add `itemId` option)
- Create: `apps/web/src/components/listing/listing-card.tsx`
- Create: `apps/web/src/components/listing/listing-card.test.tsx`
- Create: `apps/web/src/lib/marketplace-urls.ts` (extract URL builder from `listings/[id]/page.tsx`)
- Modify: `apps/web/src/app/inventory/[id]/page.tsx` (insert section between "List on Marketplace" CTA and Comps)

**Interfaces:**
- Consumes: `Listing` interface exported from `use-listings.ts` (fields: id, itemId, marketplace `"ebay"|"reverb"`, marketplaceListingId, status `"draft"|"active"|"sold"|"archived"`, price, currency, createdAt, publishedAt, soldAt, itemTitle)
- Produces:
  - `useListings({ itemId })` — passes `itemId` as query param
  - `marketplaceItemUrl(marketplace: "ebay" | "reverb", marketplaceListingId: string): string` — `https://www.ebay.com/itm/{id}` / `https://reverb.com/item/{id}` (copy exact URLs from `listings/[id]/page.tsx`; verify there before writing)
  - `<ListingCard listing={Listing} token={string|null} onChanged={() => void} highlight={boolean} />` — Task 3 extends this same component with actions

- [ ] **Step 1: Failing hook test** — extend `use-listings` test (or create `use-listings.test.ts` if absent) asserting the fetch URL contains `itemId=abc` when `useListings({ itemId: "abc" })`:

```typescript
it('passes itemId as a query param', async () => {
  // follow the file's existing api-mock pattern; assert the called path
  expect(mockedApi).toHaveBeenCalledWith(
    expect.stringContaining('itemId=abc'),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run to fail** — `npm run test -w apps/web -- use-listings`

- [ ] **Step 3: Implement hook option** — in `use-listings.ts`: add `itemId?: string` to `UseListingsOptions`, `if (options.itemId) params.set("itemId", options.itemId);` in the param builder, and `options.itemId` to the `useCallback` deps. Run test → green. Commit: `feat(web): useListings accepts itemId filter`.

- [ ] **Step 4: Failing ListingCard test** — `listing-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ListingCard } from "./listing-card";

const LISTING = {
  id: "l1", itemId: "i1", userId: "u1", marketplace: "ebay" as const,
  marketplaceListingId: "307054605978", marketplaceSpecificFields: null,
  status: "active" as const, price: 1200, currency: "USD",
  createdAt: "2026-07-10T17:24:31Z", publishedAt: "2026-07-10T17:24:33Z",
  soldAt: null, itemTitle: "ASUS ROG",
};

it("shows marketplace, status pill, and price", () => {
  render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
  expect(screen.getByText(/ebay/i)).toBeInTheDocument();
  expect(screen.getByText(/active/i)).toBeInTheDocument();
  expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
});

it("links to the live marketplace listing", () => {
  render(<ListingCard listing={LISTING} token="t" onChanged={() => {}} highlight={false} />);
  const link = screen.getByRole("link", { name: /view on ebay/i });
  expect(link).toHaveAttribute("href", "https://www.ebay.com/itm/307054605978");
});
```

- [ ] **Step 5: Run to fail**, then implement read-only `ListingCard`: rounded-xl bordered card matching item-page card styling; row 1 marketplace name + status pill (copy the pill color map from `listings/[id]/page.tsx` status banner); row 2 price (formatted `$X,XXX`, `Intl.NumberFormat`) + published date; row 3 `View on eBay/Reverb` external link via `marketplaceItemUrl` (only when `marketplaceListingId` present). `highlight` prop adds a temporary ring class (`ring-2 ring-[var(--teal)]`). Create `marketplace-urls.ts` with the extracted builder. Run test → green.

- [ ] **Step 6a: Fix BOTH existing test mocks FIRST** — `apps/web/src/app/inventory/[id]/page.test.tsx` has two mocks that break the moment the page consumes the new hooks:
  1. `:18-21` full-replaces `next/navigation` without `useSearchParams` — every test throws.
  2. `:39` mocks `useListings` as `() => ({ createListing: vi.fn() })` — Task 2 destructures `listings`/`isLoading`/`refetch`, so `itemListings.length` throws on undefined.

```ts
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "i1" }),
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => mockSearchParams,   // module-level: let mockSearchParams = new URLSearchParams();
}));
vi.mock("@/hooks/use-listings", () => ({
  useListings: () => ({ listings: mockListings, isLoading: false, refetch: vi.fn(), createListing: vi.fn() }),
})); // module-level: let mockListings: Listing[] = []; reassignable per-test
```

- [ ] **Step 6a2 (tdd-guard order): failing page-level test BEFORE wiring** — with `mockListings` set to one active listing, assert the page renders the "Marketplace Listings" heading and the card. Run red (section doesn't exist), THEN implement Step 6b. Same rule applies at Task 4 Step 1 and Task 5 Step 5 — the guard blocks implementation-first edits.

- [ ] **Step 6b: Wire section into `inventory/[id]/page.tsx`** — REQUIRED: `useSearchParams()` in an App Router page must sit under a `<Suspense>` boundary or the build fails prerendering. Mirror the established pattern in `apps/web/src/app/list/page.tsx:1-40`: split into inner component (all current page logic + the new hook calls) and an outer default export that wraps it in `<Suspense>`.

```tsx
const { listings: itemListings, isLoading: listingsLoading, refetch: refetchListings } =
  useListings({ itemId: id });
const searchParams = useSearchParams();
const focusListingId = searchParams.get("listing");
```

Also add (owner requirement 2026-07-11): a **Preview CTA** directly below the photo gallery and above the item-info block — secondary-style button "Preview listing" → `router.push(\`/inventory/${id}/preview\`)` (page built in Task 5; CTA ships in Task 5's PR too, not here, so no dead link ever deploys).

Section **placement (deliberate, from advisor review):** when ≥1 listing exists, render the Marketplace Listings section HIGH — immediately after the item-info/value block, BEFORE the Listing Optimizer — so live-listing state ("is it for sale, at what price") is first-screen adjacent, and demote the "List on Marketplace" CTA to BELOW the cards, relabeled **"List on another marketplace — reach more buyers"**, offering only marketplaces without an existing non-archived listing (this carries the old page's cross-list nudge; duplicate-listing risk drops because evidence of the live listing sits above the CTA). When zero listings: section hidden entirely (existing CTA stays primary in its current position — no empty-shell noise).

```tsx
{itemListings.length > 0 && (
  <section className="mt-4">
    <h2 className="text-sm font-semibold text-text-primary mb-2">Marketplace Listings</h2>
    <div className="flex flex-col gap-2">
      {orderedListings.map((l) => (
        <div key={l.id} id={`listing-${l.id}`}>
          <ListingCard listing={l} token={token} onChanged={refetchListings} highlight={l.id === highlightId} />
        </div>
      ))}
    </div>
  </section>
)}
```

Card ordering (adversarial review #10): GTC auto-end + relist cycles accumulate archived rows, and `createdAt desc` can stack them above the live card. Order active → draft → sold, and collapse archived under a "Show N archived" toggle:

```tsx
const STATUS_ORDER = { active: 0, draft: 1, sold: 2, archived: 3 } as const;
const orderedListings = [...itemListings].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
// render non-archived always; archived behind a count toggle
```

Deep-link scroll effect — instant (smooth-scrolling a long mobile page is seconds of jank), double-rAF so layout settles before measuring, highlight ring decays after ~2s. Adversarial fixes baked in: **one-shot ref** (without it, every `refetchListings` toggles `listingsLoading` and the effect re-yanks scroll to the card on every card action, forever) and **item-loading in the guard** (if listings resolve before the item, the page is still on its spinner, the card node isn't in the DOM, and the scroll silently never fires):

```tsx
const [highlightId, setHighlightId] = useState<string | null>(null);
const scrolledRef = useRef(false);
useEffect(() => {
  if (scrolledRef.current || !focusListingId || listingsLoading || isLoading) return; // isLoading = useItem's
  scrolledRef.current = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById(`listing-${focusListingId}`)?.scrollIntoView({ block: "center" });
    setHighlightId(focusListingId);
    setTimeout(() => setHighlightId(null), 2000);
  }));
}, [focusListingId, listingsLoading, isLoading]);
```

(`highlight={l.id === highlightId}` on the card; ring class gets `transition-shadow`.)

Also: change `CreateListingSheet` `onCreated` on THIS page from `router.push('/inventory')` to `refetchListings()` + close sheet (stay on page — the new card appears in place). Read the current `onCreated` contract comment in the page before changing; the list-page usage keeps its redirect.

- [ ] **Step 7: Verify** — PRECONDITION (deploy-order hazard): `portage-api` must already run PR1 — the current schema silently STRIPS unknown `itemId` and returns ALL the user's listings, so PR2 against a pre-PR1 API renders other items' listings as cards with no error. Prove the filter first: `curl -sk 'https://10.0.0.251:8016/listings?itemId=<some-other-item-uuid>' -H @<tokenfile>` returns only that item's rows. Then `npm run test -w apps/web`, `npm run typecheck`, `npm run lint`; run the app and screenshot: item `c19d41df` shows an eBay ACTIVE card; `?listing=8c784b48-...` scrolls/highlights once and does NOT re-scroll after a card action. (frontend-verification gate: real behavior, not just green tests.)

- [ ] **Step 8: Run /simplify on the diff** (reuse/simplification pass on the new components/hook wiring), re-run tests after any applied fix.

- [ ] **Step 9: Commit + PR** — `feat(web): marketplace listings section on item detail`

---

### Task 3 (PR 3): Port listing actions into ListingCard

**Files:**
- Modify: `apps/web/src/components/listing/listing-card.tsx` (+ its test)
- Reuse (no changes expected): `apps/web/src/components/listing/aspect-fill-sheet.tsx`, `weight-fill-sheet.tsx`
- Port-from reference: `apps/web/src/app/listings/[id]/page.tsx` — price edit block, `handleSave`, publish handler (incl. `EBAY_ASPECTS_REQUIRED` / `EBAY_WEIGHT_REQUIRED` recovery), archive/delete confirms, `GtcDateField`

**Interfaces:**
- Consumes: `ListingCard` props from Task 2 (unchanged signature — `onChanged` now also fires after every mutating action)
- Produces: card actions calling `PATCH /listings/{id}` (price, archive), `POST /listings/{id}/publish`, `DELETE /listings/{id}`, `router.push('/list?itemId=...')` (relist / cross-list)

Port rules (read the source blocks in `listings/[id]/page.tsx` before writing — signatures and error codes must match exactly):

1. **Price edit** — inline edit toggle + number input + Save calling `api(\`/listings/${l.id}\`, { method: "PATCH", body: { price }, token })`, then `onChanged()`. Port the old page's validation guard verbatim (old lines 199-204): reject `isNaN(parseFloat(v))` or `<= 0` with inline "Please enter a valid price" BEFORE the PATCH. Display format: integer dollars render clean (`$1,200`); non-integer keep cents (`$25.50`); when `l.currency !== "USD"` append the code (`$1,150 USD`-style) — the code was the only non-USD signal on the old page, don't drop it for Reverb. Item title/description editing is NOT ported — that edit surface now lives only in `/inventory/[id]/edit` (kills the overlapping-edit-surface bug). VERIFIED safe: `PATCH /items` already best-effort revises every active eBay listing (title/desc/price/photos/condition) via `items.ts:506-555` — no propagation regression. eBay only; Reverb listings are not synced on item edit (pre-existing gap, out of scope). Two UX additions so sellers can still find the edit path from the card:
   - `ListingCard` gets a quiet "Edit title & description" link → `/inventory/${l.itemId}/edit`
   - `/inventory/[id]/edit` shows one line of copy when the item has any non-archived listing: "Title and description are shared across marketplaces — saving updates your live eBay listing." (fetch via `useListings({ itemId })`)
2. **Publish** (status `draft`) — port the publish handler verbatim including the two recovery flows: on `ApiError.code === "EBAY_ASPECTS_REQUIRED"` open `AspectFillSheet`, on `"EBAY_WEIGHT_REQUIRED"` open `WeightFillSheet`; each sheet's save re-POSTs publish, then `onChanged()`. PRESERVE the aspect-sheet prefill (old lines 757-761): the sheet is seeded `initial={{ Brand: [item.brand], Model: [item.model] }}` from the item — the card doesn't hold the item, so `ListingCard` gains two optional props `itemBrand?: string; itemModel?: string` passed from the item page (item is already loaded there; no extra fetch). Disabled publish button keeps the old explanatory tooltip: `title="Save your changes before publishing"` when the price edit is dirty (old line 647).
3. **Archive** (status `active`) — confirm sheet → `PATCH { status: "archived" }` → `onChanged()`.
4. **Delete** (status `draft`/`archived`) — confirm sheet → `DELETE /listings/{id}` → `onChanged()`.
5. **Relist** (status `sold`/`archived`) — `router.push(\`/list?itemId=${l.itemId}\`)`.
6. **GTC auto-end date** — port `GtcDateField` (fetches `GET /seller-profile`, computes via `nextGtcRenewal` from `@/lib/gtc`) rendered only for `marketplace === "ebay" && status === "active"`. The old page's ONLY test file is `apps/web/src/app/listings/[id]/gtc-date.test.tsx` and it dies with the page in Task 4 — port BOTH its assertions into `listing-card.test.tsx` before Task 4 runs: (a) with `gtc_auto_end` true, "Auto-ends" date = `nextGtcRenewal(publishedAt) - 2 days`; (b) with it false, "GTC renews" date shown and "Auto-ends" absent. Without this port the auto-end arithmetic loses all coverage.
6b. **Card detail slots (advisor review):** sold cards show `soldAt` date; Publish button disabled while a price edit is uncommitted (ports the old `hasChanges` guard's job); card reserves an inline warning slot for marketplace sync warnings (`saveWarning` was a page-level banner on the old page — without a designated slot it gets dropped in the port) and for publish error text (the old page's full-width error banner shrinks to card scope — keep it prominent: full card-width, error color, above actions).
6c. **Marketplace listing ID row (field-parity audit):** when `marketplaceListingId` is set, card shows the raw ID in JetBrains Mono (`--font-jetbrains`), tap-to-copy (`navigator.clipboard.writeText` + brief "Copied" affordance), alongside the View link — the raw ID is used directly for Seller Hub lookups and is diagnostic (eBay: `3`-prefix = live Trading listing, `1`-prefix = orphaned offer/silent publish failure — see memory `reference_ebay_listing_id_prefix`). Card meta line also carries `createdAt` next to published/sold dates, completing field parity: every field the old page displayed now has a home (title/desc → item section + editor; photo → gallery; item grid → item info; ID/dates/GTC/price/status/actions/banners → card).
7. Confirm sheets: extract ONE shared `ConfirmSheet` component (`apps/web/src/components/ui/confirm-sheet.tsx` + test) from the triple-duplicated modal markup in the two source pages — props `{ title, body, confirmLabel, destructive, onConfirm, onClose }`. Use it for archive + delete here; do NOT retrofit other pages in this PR (surgical rule).

- [ ] **Step 1: Failing tests** — extend `listing-card.test.tsx` per action; core cases:

```tsx
it("publishes a draft and calls onChanged", async () => {
  mockedApi.mockResolvedValueOnce({});           // POST /listings/l1/publish
  const onChanged = vi.fn();
  render(<ListingCard listing={{ ...LISTING, status: "draft", marketplaceListingId: null }} token="t" onChanged={onChanged} highlight={false} />);
  await userEvent.click(screen.getByRole("button", { name: /publish/i }));
  expect(mockedApi).toHaveBeenCalledWith("/listings/l1/publish", expect.objectContaining({ method: "POST" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

it("opens the aspect sheet when publish returns EBAY_ASPECTS_REQUIRED", async () => {
  mockedApi.mockRejectedValueOnce(new ApiError(422, "EBAY_ASPECTS_REQUIRED", "aspects", []));
  render(<ListingCard listing={{ ...LISTING, status: "draft" }} token="t" onChanged={vi.fn()} highlight={false} />);
  await userEvent.click(screen.getByRole("button", { name: /publish/i }));
  expect(await screen.findByText(/required.*specifics/i)).toBeInTheDocument(); // AspectFillSheet heading — copy exact string from the sheet
});

it("archives an active listing after confirm", async () => {
  mockedApi.mockResolvedValueOnce({});
  render(<ListingCard listing={LISTING} token="t" onChanged={vi.fn()} highlight={false} />);
  await userEvent.click(screen.getByRole("button", { name: /archive/i }));
  await userEvent.click(screen.getByRole("button", { name: /^archive$/i })); // confirm sheet
  expect(mockedApi).toHaveBeenCalledWith("/listings/l1", expect.objectContaining({ method: "PATCH", body: { status: "archived" } }));
});
```

(Match the file's existing api-mock pattern from Task 2; check `ApiError` constructor signature in `apps/web/src/lib/api.ts` before writing the rejection test.)

- [ ] **Step 2: Run to fail**, implement action-by-action (one test red → green → next), reusing the exact handler code from `listings/[id]/page.tsx` adapted to card scope.

- [ ] **Step 3: Full verify** — web tests, typecheck, lint; run app: publish a real draft from the card (or the aspect-sheet recovery path with a missing-aspects item), archive/unarchive round-trip, GTC date renders on the ASUS card. Screenshots.

- [ ] **Step 4: Run /simplify on the diff** — highest-value slot: the 851-line action port is where carried-over duplication hides. Re-run tests after any applied fix.

- [ ] **Step 5: Commit + PR** — `feat(web): listing actions on item-detail cards`

---

### Task 4 (PR 4): Retire listings/[id] — redirect + retarget links

**Files:**
- Modify: `apps/web/src/app/listings/[id]/page.tsx` — replace the 851-line page with a resolver-redirect
- Modify — retarget every `/listings/${id}` href/push to `/inventory/${itemId}?listing=${listingId}`. VERIFIED complete consumer list (reviewer grep, 2026-07-11):
  - `apps/web/src/app/(tabs)/listings/page.tsx:101` (row link; `listing.itemId` on the row)
  - `apps/web/src/components/listing-flow/publish-success.tsx:76` — component has only `listingId` in props; retarget requires adding an `itemId` prop AND threading it at all 4 call sites: `conversational-flow.tsx:812`, `hybrid-flow.tsx:495` + `:937`, `swipe-flow.tsx:1767` (pass `state.inventoryItemId` — already in flow state per `use-listing-flow.ts:96,449`; null falls back to `/inventory`)
  - `apps/web/src/components/listing/create-listing-sheet.tsx:199` ("View listing" success link; `itemId` already a prop at line 22)
  - `apps/web/src/app/(tabs)/home/page.tsx:388` (Recent Listings card; `RecentListing` carries `itemId` per `use-dashboard.ts:7-19`)
  - Re-run the grep at execution time anyway (`grep -rn '/listings/\${' apps/web/src`) — line numbers drift
- Delete: dead helpers orphaned by the rewrite (`ReadOnlyField`, `GtcDateField` original, page-local handlers) — they died with the page they lived in

**Interfaces:**
- Consumes: `?listing=` deep-link behavior from Task 2
- Produces: `/listings/[id]` = permanent client redirect; no page renders

- [ ] **Step 1a (tdd-guard order): failing redirect test** — new `apps/web/src/app/listings/[id]/page.test.tsx`: mock `api` to resolve `{ id: "l1", itemId: "i1" }`, render, assert `router.replace` called with `/inventory/i1?listing=l1`; second case: api rejects → `router.replace("/listings")`. Run red (old page renders, no replace), then Step 1b.

- [ ] **Step 1b: Redirect implementation** (external bookmarks/history keep working):

```tsx
"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { Listing } from "@/hooks/use-listings";

export default function ListingRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, isReady, isAuthenticated } = useAuth();

  // Without this bounce, a transient session-exchange failure (isReady true,
  // token null — auth-provider.tsx:77-84) leaves an infinite spinner. The old
  // page had exactly this guard (listings/[id]/page.tsx:138-140) — keep it.
  useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/listings");
  }, [isReady, isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    api<Listing>(`/listings/${id}`, { token })
      .then((l) => router.replace(`/inventory/${l.itemId}?listing=${l.id}`))
      .catch(() => router.replace("/listings"));
  }, [id, token, router]);

  // Spinner, not null — a blank page during the resolve round-trip reads as broken.
  // Copy the standard loading state used by the old listings/[id] page.
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--teal)] border-t-transparent" />
    </div>
  );
}
```

(Confirm `GET /listings/:id` response shape — if it wraps as `{ listing }`, unwrap accordingly; check the route in `apps/api/src/routes/listings.ts` first.)

- [ ] **Step 2: Failing test for tab link** — in the listings tab test (or new): assert row link href is `/inventory/i1?listing=l1`. Run red, retarget links, run green.

- [ ] **Step 3: Retarget the four Playwright e2e specs** — `apps/web/e2e/` drives the OLD page by URL + label-specific selectors; all four break without this:
  - `phase-f-archive.spec.ts:19-29` and `phase-f-archive-live.spec.ts:50-56` — `goto('/listings/${id}')` + button `"Archive Listing"` → goto `/inventory/${itemId}?listing=${id}`, button names per new card labels
  - `phase-f-scan-publish.spec.ts:51-53` — `"Publish to eBay"` selector → the card's publish label (decide the card label first, keep spec+card consistent)
  - `gtc-auto-end.spec.ts:41-43` — expects "Auto-ends"/"GTC renews" text; retarget URL + wait for deep-link scroll/settle before asserting
  (Unaffected, verified: `phase-f-proof`, `f4-publish-result`, `inline-edit`, `publish-idempotency`, `listing-optimizer` specs.)

- [ ] **Step 4: Docs + route-map staleness** — same PR: update `website/docs/frontend/app-structure.md:33` (route table row for `/listings/[id]` → redirect + card model), `website/docs/features.md:151` (Listing Detail Page row), and `apps/web/CLAUDE.md` App Router tree (listed twice — mark redirect).

- [ ] **Step 5: Verify no orphans** — `npm run lint` (unused imports), grep `/listings/${'{'}` for missed pushes, web tests + typecheck. At each of the 4 link retargets, confirm the row object actually carries `itemId` before rewriting (verified for `RecentListing` and `create-listing-sheet` props; re-confirm listings-tab row + publish-success at execution). Behavior note (accepted): a deleted/stale-bookmark listing ID now silently bounces to `/listings` — the old page's explicit "Listing not found" screen is not preserved.

- [ ] **Step 6: Run the app end-to-end** — Listings tab row → lands on item page scrolled to highlighted card; old `/listings/8c784b48-...` URL redirects; publish/archive from card still works post-retarget. Screenshots.

- [ ] **Step 7: Commit + PR** — `feat(web): retire listing detail page — redirect to item hub`

---

### Task 5 (PR 5): Sharable listing preview page + PNG share

**Files:**
- Create: `apps/web/src/app/inventory/[id]/preview/page.tsx`
- Create: `apps/web/src/components/listing/listing-preview-share-card.tsx` (+ `.test.tsx`)
- Modify: `apps/web/src/app/inventory/[id]/page.tsx` — Preview CTA below photo gallery, above item info
- Modify: `apps/web/package.json` — add `html-to-image`

**Interfaces:**
- Consumes: `useItem(id)`, `useListings({ itemId })` (Task 2), `resolvePublishPriceWithSource` (already imported by the item page — read its signature there first)
- Produces: `/inventory/[id]/preview` route; `<ListingPreviewShareCard item={Item} price={number|null} />` — pure presentational, the PNG capture target

Design: buyer-eye card, no app chrome — hero photo (primary), title (display font), price large, condition pill, first ~200 chars of description, "Sold with Portage" footer mark. Price = active listing's price if one exists, else `resolvePublishPriceWithSource` fallback chain. Header: back chevron + one primary **Share** button.

- [ ] **Step 1: CORS spike (10 min, gate for the approach)** — in the running app, from the item page console: draw a photo `<img crossOrigin="anonymous">` from R2 onto a canvas and call `toDataURL()`. If it throws SecurityError, add the bucket CORS rule (AllowedOrigins: app origins, GET) in Cloudflare R2 settings BEFORE proceeding — html-to-image has the same taint constraint. Record the result in the PR description.

- [ ] **Step 2: Failing card test** — `listing-preview-share-card.test.tsx`:

```tsx
it("renders title, price, condition, and hero photo", () => {
  render(<ListingPreviewShareCard item={MOCK_ITEM} price={1200} />);
  expect(screen.getByText("Sony WH-1000XM4")).toBeInTheDocument();
  expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
  expect(screen.getByText(/good/i)).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("crossorigin", "anonymous");
});
```

- [ ] **Step 3: Run red → implement card** — presentational component; hero `<img crossOrigin="anonymous">`; fixed aspect card (4:5, portrait-share friendly) so the PNG is composition-stable; DHG tokens (display font for title, teal accent). Run green.

- [ ] **Step 4: Preview page + share handler:**

```tsx
"use client";
import { useRef, useState } from "react";
import { toBlob } from "html-to-image";

const cardRef = useRef<HTMLDivElement>(null);
const [sharing, setSharing] = useState(false);

async function handleShare() {
  if (!cardRef.current || sharing) return;
  setSharing(true);
  try {
    // Readiness guard (adversarial #8): toBlob serializes the DOM immediately —
    // a still-streaming R2 hero renders as a blank region in the PNG (Safari's
    // foreignObject pipeline drops undecoded images even post-onload). Await
    // decode of every img in the card first; Share button is also disabled
    // until the hero's onLoad fires.
    await Promise.all(
      [...cardRef.current.querySelectorAll("img")].map((i) => i.decode().catch(() => {})),
    );
    const blob = await toBlob(cardRef.current, { pixelRatio: 2 });
    if (!blob) throw new Error("capture failed");
    const file = new File([blob], `${item.title.slice(0, 40)}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: item.title });
    } else {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") setShareError("Couldn't create the share image. Try again.");
  } finally {
    setSharing(false);
  }
}
```

Page fetches item + listings, renders `<div ref={cardRef}><ListingPreviewShareCard …/></div>` + Share button (spinner while `sharing`); AbortError (user cancels share sheet) is silent. Page-level test: share button calls `navigator.share` with a File when `canShare` true (mock `html-to-image`'s `toBlob`).

- [ ] **Step 5: Wire the Preview CTA** — tdd-guard order: first a failing page test (tap "Preview listing" → `pushMock` called with `/inventory/i1/preview`), run red, then add the CTA to `inventory/[id]/page.tsx` below the photo gallery: secondary button style (bordered, not the green primary), label "Preview listing", `router.push`.

- [ ] **Step 6: Verify** — tests + typecheck + lint; run app on a phone-sized viewport: open preview for item c19d41df, tap Share — real share sheet on mobile Chrome/Safari, PNG download on desktop; PNG shows photo (not blank/tainted — the Step 1 gate proves out here). Screenshots + the generated PNG attached to PR.

- [ ] **Step 7: Commit + PR** — `feat(web): sharable listing preview with PNG share`

## Deferred (explicitly out of scope)

- Retrofitting `ConfirmSheet` into item-delete and other existing modals (separate cleanup PR)
- Unifying the duplicated `DetailField`/`ReadOnlyField` grids (ReadOnlyField dies with the old page; DetailField stays as-is)
- apps/web local `Item` interface vs `@portage/shared` duplication (pre-existing, tracked in registry)
- Order detail page — stays separate by design

## Advisor Review (2026-07-11) — incorporated

Two independent reviews (technical vs codebase + UX advisor) amended this plan:
- BLOCKER: `useSearchParams` Suspense split (pattern: `list/page.tsx`) — Task 2 Step 6b
- BLOCKER: `page.test.tsx` next/navigation mock lacks `useSearchParams` — Task 2 Step 6a
- Section placement above optimizer + demoted cross-list CTA (duplicate-listing risk) — Task 2
- Verified `PATCH /items` → eBay revise propagation exists (`items.ts:506-555`); edit-page shared-fields copy + card edit link — Task 3
- Card slots: soldAt, publish-disabled-on-dirty-price, sync-warning/error slots — Task 3
- Verified complete `/listings/${id}` consumer list (4 files; porter pills was a false lead) — Task 4
- Instant deep-link scroll + decaying highlight + spinner redirect — Tasks 2/4
- Watch-item: if per-listing analytics/messages land later, evolve cards into expandable/bottom-sheet, not a new page

## Adversarial Review (2026-07-11) — incorporated

Fresh attack-mandated agent; 10 attacks survived code verification (9 refuted), all folded in:
scroll-effect re-yank on every refetch (one-shot ref) · deep-link race vs item load (isLoading in guard) · `use-listings` page-test mock breakage (Step 6a) · 3 tdd-guard implementation-first violations (failing tests added: section render, redirect, CTA) · PR1→PR2 deploy-order silent-wrong-data window (curl precondition) · redirect infinite spinner on transient auth failure (isAuthenticated bounce) · publish-success itemId threading, 4 call sites · preview PNG blank-hero race (img.decode guard) · highlight prop self-contradiction (fixed to highlightId) · archived-card accumulation (status ordering + collapse toggle).
Notable refuted (don't re-litigate): useListings deps are primitives (no refetch loop); cards keyed by stable id (open sheets survive refetch); photo strip is fixed-size (no layout-shift scroll drift); PR4 deploy window is atomic (frontend-only).

## Self-Review Notes

- Spec coverage: hub section (T2), all 6 listing actions + GTC (T3), cross-nav both directions (T2 deep-link + T4 retarget), duplication removal (T3 ConfirmSheet, T4 page deletion), overlapping edit surface eliminated (T3 rule 1). ✓
- Types: `ListingCard` signature identical T2→T3; `Listing` imported from `use-listings.ts` everywhere; query param name `itemId` consistent T1→T2. ✓
- Every task independently shippable: T1 API-only (inert), T2 additive UI, T3 additive actions (old page still works), T4 the cutover. ✓
