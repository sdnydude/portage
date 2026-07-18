# R1 Desktop Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop (≥1024px), inventory and listings become master-detail workbenches — persistent list pane + live detail/edit pane with arrow-key navigation, no page swaps. Mobile/tablet flows unchanged.

**Architecture:** The 1001-line `inventory/[id]` edit surface is extracted into a prop-driven `ItemDetail` component (route page becomes a thin wrapper — zero behavior change). A new `MasterDetail` layout component renders two independently scrolling panes under the 64px TopBar, following the R0 CSS-only breakpoint idiom (both mobile and desktop DOM render; `lg:` classes decide visibility — no hydration flicker). Selection is client state + `history.replaceState` deep-links (App Router has no shallow routing; `router.push` would remount the page and refetch).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Vitest + Testing Library (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-responsive-shell-design.md` (R1 = "master-detail workbench panes" in the pane-capable `shell-main` region, reserved in `app-shell.tsx:34`). Backlog line: `docs/TODO.md` Phase R1.

## Global Constraints

- Worktree: `/home/swebber64/DHG/portage-ui-refactor`, branch `feat/ui-refactor` (already created off main @ 1f79f5c). ALL work happens here — the main checkout at `/home/swebber64/DHG/portage` has a concurrent build running; never edit there.
- tdd-guard is ACTIVE on apps/web: **one test per Write/Edit, red first**, then minimal implementation. Run: `npm run test -w apps/web -- <file>`. If the validator hedges on a compliant single-test edit, retry the same edit verbatim once. Prefer small Edits over full-file Writes.
- Stage **explicit paths only** — never `git add -u/-A`.
- No co-author trailers on commits.
- All URLs use `10.0.0.251`, never localhost. App: `http://10.0.0.251:3002`.
- Breakpoint: workbench is `lg` (≥1024px) only — matches the R0 shell (sidebar + TopBar appear at `lg`).
- TopBar is `h-16` (64px, sticky — `top-bar.tsx:35`); workbench height is `calc(100dvh - 4rem)`.
- Design system: Forest Green `var(--forest-green)`, card idiom `bg-surface rounded-xl border border-border`, fonts `--font-instrument` (display) / `--font-plus-jakarta` (body).
- **Full-stack wiring (standing rule, no exceptions):** every surface binds to real API endpoints through the existing hooks — no mock data in product code, no dead endpoints. This feature consumes (all pre-existing, all stay wired): `GET /items` (useItems), `GET/PATCH/DELETE /items/:id` (useItem), `GET /listings` + `?itemId=` (useListings), `POST /items/bulk/{delete,update}`, `POST /listings/bulk/{delete,archive,activate}`, `GET /items/:id/comps` (useComps), `POST /images` + `/images/{rotate,crop,exposure,remove-bg}` (photo tools), export endpoints (useExport). No new API endpoints are needed; the detail pane reuses the fully-wired ItemDetail surface. Task 7 verifies each of these live.
- DoD: rebuild/run app + observe real behavior (frontend-verification gate). Compiles + green tests ≠ done.

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/components/inventory/item-detail.tsx` | Create — prop-driven `ItemDetail` (moved `ItemDetailContent` + helpers from the route file) |
| `apps/web/src/components/inventory/item-detail.test.tsx` | Create — prop plumbing + pane-variant tests |
| `apps/web/src/app/inventory/[id]/page.tsx` | Modify — becomes thin route wrapper (params/searchParams/router → props) |
| `apps/web/src/hooks/use-list-nav.ts` | Create — arrow-key selection over an ordered id list |
| `apps/web/src/hooks/use-list-nav.test.ts` | Create |
| `apps/web/src/components/workbench/master-detail.tsx` | Create — two-pane lg-only layout shell |
| `apps/web/src/components/workbench/master-detail.test.tsx` | Create |
| `apps/web/src/components/inventory/item-card.tsx` | Modify — optional `onOpen`/`selected` props (button mode for workbench) |
| `apps/web/src/components/inventory/item-card.test.tsx` | Modify — add button-mode tests |
| `apps/web/src/app/(tabs)/inventory/page.tsx` | Modify — `ItemsGrid` extraction + workbench integration |
| `apps/web/src/app/(tabs)/inventory/workbench.test.tsx` | Create |
| `apps/web/src/app/(tabs)/listings/page.tsx` | Modify — `ListingCard` onOpen + workbench integration |
| `apps/web/src/app/(tabs)/listings/workbench.test.tsx` | Create |
| `apps/web/src/app/(tabs)/layout.tsx` | Modify — `pb-24` → `pb-24 lg:pb-0` (tab-bar clearance is mobile-only) |
| `docs/TODO.md` | Modify — check off Phase R1 |

---

### Task 1: Extract prop-driven `ItemDetail` from the route page

**Files:**
- Create: `apps/web/src/components/inventory/item-detail.tsx`
- Modify: `apps/web/src/app/inventory/[id]/page.tsx` (currently 1001 lines)
- Test: `apps/web/src/components/inventory/item-detail.test.tsx`
- Regression gate: `apps/web/src/app/inventory/[id]/page.test.tsx` (536 lines, must stay green UNCHANGED)

**Interfaces:**
- Consumes: everything the current `ItemDetailContent` consumes (useItem, useComps, useListings, useEnhance, useBgRemoval, photo components…) — unchanged.
- Produces (Tasks 5–6 rely on this exact signature):

```typescript
interface ItemDetailProps {
  itemId: string;
  focusListingId?: string | null;   // replaces the ?listing= searchParam read
  variant?: "page" | "pane";        // default "page"; "pane" = embedded in workbench
  onDeleted: () => void;            // called after successful delete (replaces router.replace("/inventory"))
  onBack: () => void;               // called by back chevron + not-found back (replaces router.back())
}
export function ItemDetail(props: ItemDetailProps): JSX.Element
```

- [ ] **Step 1: Write the failing test — renders from an `itemId` prop**

Create `apps/web/src/components/inventory/item-detail.test.tsx` (ONE test — tdd-guard). Copy the entire `vi.hoisted` + `vi.mock` block from `apps/web/src/app/inventory/[id]/page.test.tsx` verbatim (hook mocks for `use-auth`, `use-item`, `use-listings`, `use-enhance`, `use-comps`, `use-bg-removal`, `@/lib/api`, and the child-component stubs — CropTool, CreateListingSheet, ListingOptimizerPanel, etc.), with ONE change: in the `next/navigation` mock, drop `useParams` and `useSearchParams` (props replace them), keep `useRouter`:

```typescript
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
```

Then the test:

```typescript
import { ItemDetail } from "./item-detail";

describe("ItemDetail (prop-driven)", () => {
  it("renders the item given an itemId prop, without route params", () => {
    render(
      <ItemDetail itemId="i1" onDeleted={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText(h.item.title)).toBeInTheDocument();
  });
});
```

(`h.item` is the hoisted mock item from the copied block; `useItem` is mocked to return it regardless of id, same as in page.test.tsx.)

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/inventory/item-detail.test.tsx`
Expected: FAIL — cannot resolve `./item-detail`.

- [ ] **Step 3: Move the component (mechanical extraction)**

Create `apps/web/src/components/inventory/item-detail.tsx` by moving from `app/inventory/[id]/page.tsx`: the entire `ItemDetailContent` function (L37–~875) plus the private helpers `DetailField` (L893), `mapEbayCondition` (L902), `CompSection` (L912), plus every import they use. Do NOT move the default-export Suspense wrapper. Then apply these substitutions inside the moved code:

1. Rename `ItemDetailContent` → `ItemDetail`, add the props signature above (`{ itemId, focusListingId = null, variant = "page", onDeleted, onBack }: ItemDetailProps`), export it.
2. Delete `const params = useParams<{ id: string }>();` and the `useParams` import. Replace every `params.id` with `itemId` — 6 sites: `useItem(params.id)` (was L41), `useComps(params.id)` (L56), `useListings({ itemId: params.id })` (L132), the preview `router.push(\`/inventory/${params.id}/preview\`)` (L492), `ListingOptimizerPanel itemId={params.id}` (L717), and any remaining.
3. Delete `const searchParams = useSearchParams();` + the `const focusListingId = searchParams.get("listing")` line (was L136-137) and the `useSearchParams` import — the prop supplies it. The auto-expand + `scrollIntoView` effect (L146-163) keeps working off the prop.
4. Delete-success handler (was L423): `router.replace("/inventory")` → `onDeleted()`.
5. Back chevron (was L441) and not-found back button (L391): `router.back()` → `onBack()`.
6. Keep `router` for the remaining pushes (`/inventory/${itemId}/edit`, preview, not-found "Browse inventory" push) and the unauth `router.replace("/inventory")` — correct in both contexts.
7. Variant styling: outer wrappers' `min-h-screen` (was L379, L387, L436) → `` `${variant === "pane" ? "min-h-full" : "min-h-screen"}` ``; wrap the back chevron button in `{variant === "page" && (…)}` (the pane has the list beside it — a back arrow there is dead UI; `onBack` still fires from not-found).

- [ ] **Step 4: Rewrite the route page as a thin wrapper**

Replace `apps/web/src/app/inventory/[id]/page.tsx` entirely with:

```tsx
"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ItemDetail } from "@/components/inventory/item-detail";

// Suspense split: useSearchParams requires it (same reason as before the extraction).
function ItemDetailRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <ItemDetail
      itemId={params.id}
      focusListingId={searchParams.get("listing")}
      onDeleted={() => router.replace("/inventory")}
      onBack={() => router.back()}
    />
  );
}

export default function ItemDetailPage() {
  return (
    <Suspense fallback={null}>
      <ItemDetailRoute />
    </Suspense>
  );
}
```

- [ ] **Step 5: Run both test files — verify green**

Run: `npm run test -w apps/web -- src/components/inventory/item-detail.test.tsx src/app/inventory`
Expected: new test PASS, and ALL existing `page.test.tsx` tests PASS with zero edits to that file (it mocks `useParams`/`useSearchParams`/`useRouter` at the route level, which the wrapper still consumes). If page.test.tsx breaks, the extraction changed behavior — fix the extraction, not the test.

- [ ] **Step 6: Add pane-variant test (red→green)**

Append ONE test to `item-detail.test.tsx`:

```typescript
  it("hides the back chevron in pane variant", () => {
    render(
      <ItemDetail itemId="i1" variant="pane" onDeleted={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });
```

Run red first (if Step 3.7 already made it pass, that's a green guard-rail pinning Step 3.7 — acceptable, note it). If the back button has no accessible name in the current markup, add `aria-label="Back"` to it while moving (Step 3.7) and query by that.

- [ ] **Step 7: Add onDeleted test (red→green)**

Append ONE test:

```typescript
  it("calls onDeleted after a confirmed delete", async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<ItemDetail itemId="i1" onDeleted={onDeleted} onBack={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /^delete item$/i }));
    expect(h.deleteItem).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });
```

(Match the confirm-modal button names to the real markup — check the delete-confirm modal moved in Step 3; page.test.tsx's existing delete test shows the exact accessible names to use.)

- [ ] **Step 8: Typecheck + full web suite**

Run: `npm run typecheck && npm run test -w apps/web`
Expected: clean. The extraction touches many imports — typecheck is the real gate here.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/inventory/item-detail.tsx apps/web/src/components/inventory/item-detail.test.tsx "apps/web/src/app/inventory/[id]/page.tsx"
git commit -m "refactor(web): extract prop-driven ItemDetail from inventory/[id] route"
```

---

### Task 2: `useListNav` — arrow-key selection hook

**Files:**
- Create: `apps/web/src/hooks/use-list-nav.ts`
- Test: `apps/web/src/hooks/use-list-nav.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Tasks 5–6 rely on this):

```typescript
function useListNav(options: {
  ids: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): { onKeyDown: (e: React.KeyboardEvent) => void }
```

No keyboard-nav utility exists in the codebase (verified — only an inline menu handler in `top-bar.tsx:63`); this is greenfield.

- [ ] **Step 1: Write the failing test — ArrowDown advances**

Create `apps/web/src/hooks/use-list-nav.test.ts` (ONE test):

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useListNav } from "./use-list-nav";

const keyEvent = (key: string) =>
  ({ key, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent;

describe("useListNav", () => {
  it("selects the next id on ArrowDown", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "a", onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowDown"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/hooks/use-list-nav.test.ts`
Expected: FAIL — cannot resolve `./use-list-nav`.

- [ ] **Step 3: Implement**

```typescript
"use client";

import { useCallback } from "react";

interface UseListNavOptions {
  ids: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Arrow-key selection over an ordered id list (R1 workbench list panes). */
export function useListNav({ ids, selectedId, onSelect }: UseListNavOptions) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (ids.length === 0) return;
      const idx = selectedId ? ids.indexOf(selectedId) : -1;
      let next: number;
      switch (e.key) {
        case "ArrowDown":
          next = Math.min(idx + 1, ids.length - 1);
          break;
        case "ArrowUp":
          next = idx <= 0 ? 0 : idx - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = ids.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      if (ids[next] !== selectedId) onSelect(ids[next]);
    },
    [ids, selectedId, onSelect],
  );

  return { onKeyDown };
}
```

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/hooks/use-list-nav.test.ts`
Expected: PASS.

- [ ] **Step 5: Add remaining tests ONE AT A TIME (red→green each)**

Test 2 — no selection yet, ArrowDown selects the first id:

```typescript
  it("selects the first id on ArrowDown when nothing is selected", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b"], selectedId: null, onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowDown"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });
```

Test 3 — ArrowUp at the top does not re-fire:

```typescript
  it("does not re-select on ArrowUp at the first id", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b"], selectedId: "a", onSelect }),
    );
    result.current.onKeyDown(keyEvent("ArrowUp"));
    expect(onSelect).not.toHaveBeenCalled();
  });
```

Test 4 — Home/End jump:

```typescript
  it("jumps to first and last with Home and End", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a", "b", "c"], selectedId: "b", onSelect }),
    );
    result.current.onKeyDown(keyEvent("End"));
    expect(onSelect).toHaveBeenCalledWith("c");
    result.current.onKeyDown(keyEvent("Home"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });
```

Test 5 — other keys ignored (no preventDefault):

```typescript
  it("ignores non-navigation keys", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListNav({ ids: ["a"], selectedId: "a", onSelect }),
    );
    const e = keyEvent("Enter");
    result.current.onKeyDown(e);
    expect(onSelect).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-list-nav.ts apps/web/src/hooks/use-list-nav.test.ts
git commit -m "feat(web): useListNav — arrow-key selection hook for workbench panes"
```

---

### Task 3: `MasterDetail` layout component

**Files:**
- Create: `apps/web/src/components/workbench/master-detail.tsx`
- Test: `apps/web/src/components/workbench/master-detail.test.tsx`

**Interfaces:**
- Produces (Tasks 5–6 rely on this):

```typescript
function MasterDetail(props: {
  list: React.ReactNode;
  detail: React.ReactNode;
  listLabel: string; // aria-label for the list pane region
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `master-detail.test.tsx` (ONE test):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasterDetail } from "./master-detail";

describe("MasterDetail", () => {
  it("renders list and detail panes with the list labelled", () => {
    render(
      <MasterDetail
        list={<div>list-content</div>}
        detail={<div>detail-content</div>}
        listLabel="Inventory list"
      />,
    );
    const listPane = screen.getByRole("region", { name: "Inventory list" });
    expect(listPane).toHaveTextContent("list-content");
    expect(screen.getByText("detail-content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/workbench/master-detail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

interface MasterDetailProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  listLabel: string;
}

/**
 * Desktop (lg+) two-pane workbench: fixed-width scrolling list + fluid detail.
 * Height pins to the viewport minus the 64px sticky TopBar so each pane
 * scrolls independently — no page swaps (Phase R1).
 */
export function MasterDetail({ list, detail, listLabel }: MasterDetailProps) {
  return (
    <div data-testid="workbench" className="hidden h-[calc(100dvh-4rem)] min-w-0 lg:flex">
      <section
        aria-label={listLabel}
        className="w-[380px] shrink-0 overflow-y-auto border-r border-border"
      >
        {list}
      </section>
      <section className="min-w-0 flex-1 overflow-y-auto">{detail}</section>
    </div>
  );
}
```

(jsdom doesn't compute `hidden lg:flex` visibility — the test asserts structure, not breakpoint behavior; Task 7 verifies breakpoints live.)

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/components/workbench/master-detail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/workbench/master-detail.tsx apps/web/src/components/workbench/master-detail.test.tsx
git commit -m "feat(web): MasterDetail two-pane workbench layout (lg+)"
```

---

### Task 4: `ItemCard` button mode (`onOpen` / `selected`)

**Files:**
- Modify: `apps/web/src/components/inventory/item-card.tsx` (currently: `ItemCard({ item, view })`, both view variants return a `<Link href={/inventory/${item.id}}>`)
- Test: `apps/web/src/components/inventory/item-card.test.tsx` (exists — append)

**Interfaces:**
- Produces (Task 5 relies on this):

```typescript
interface ItemCardProps {
  item: Item;                // import type { Item } from "@/hooks/use-items" (unchanged)
  view: "grid" | "list";
  onOpen?: () => void;       // when set: render a <button> instead of <Link> (workbench selection)
  selected?: boolean;        // workbench: ring highlight + aria-current
}
```

- [ ] **Step 1: Write the failing test — onOpen renders a button and fires**

Append ONE test to `item-card.test.tsx` (reuse the file's existing mock item fixture; add `fireEvent` or `userEvent` import if absent):

```tsx
  it("renders as a button and fires onOpen when provided (workbench mode)", () => {
    const onOpen = vi.fn();
    render(<ItemCard item={mockItem} view="list" onOpen={onOpen} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
```

(Adapt `mockItem` to the fixture name actually used in the existing file.)

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/inventory/item-card.test.tsx`
Expected: FAIL — link still rendered / no button.

- [ ] **Step 3: Implement — wrapper split**

Restructure `ItemCard` so each view variant computes its inner JSX and className, then renders through one wrapper:

```tsx
export function ItemCard({ item, view, onOpen, selected }: ItemCardProps) {
  // …existing primaryPhoto / valueDisplay computation unchanged…

  const className =
    view === "list"
      ? "flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-border-focus transition-colors"
      : "block bg-surface rounded-xl border border-border hover:border-border-focus transition-colors overflow-hidden";

  const content = view === "list" ? (
    <>{/* existing list-variant children, unchanged */}</>
  ) : (
    <>{/* existing grid-variant children, unchanged */}</>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-item-id={item.id}
        aria-current={selected ? "true" : undefined}
        className={`${className} w-full text-left ${selected ? "ring-2 ring-forest-green border-transparent" : ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/inventory/${item.id}`} className={className}>
      {content}
    </Link>
  );
}
```

The move is mechanical: lift the two variants' children out of their `<Link>`s into `content`; classNames above are copied verbatim from the current file (grid variant gains `block` so the button/link box behavior matches). `data-item-id` is the scroll-into-view anchor for Task 5.

- [ ] **Step 4: Run — verify green (whole file)**

Run: `npm run test -w apps/web -- src/components/inventory/item-card.test.tsx`
Expected: ALL tests pass — existing link-mode tests prove no regression.

- [ ] **Step 5: Add selected-state test (red→green)**

Append ONE test:

```tsx
  it("marks the selected card with aria-current", () => {
    render(<ItemCard item={mockItem} view="list" onOpen={vi.fn()} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");
  });
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/inventory/item-card.tsx apps/web/src/components/inventory/item-card.test.tsx
git commit -m "feat(web): ItemCard workbench button mode — onOpen + selected ring"
```

---

### Task 5: Inventory workbench integration

**Files:**
- Modify: `apps/web/src/app/(tabs)/inventory/page.tsx`
- Modify: `apps/web/src/app/(tabs)/layout.tsx` (one class)
- Test: `apps/web/src/app/(tabs)/inventory/workbench.test.tsx` (create — the page has NO existing test file)

**Interfaces:**
- Consumes: `ItemDetail` (Task 1), `useListNav` (Task 2), `MasterDetail` (Task 3), `ItemCard.onOpen/selected` (Task 4), plus everything the page already uses (`useItems`, `useBulkSelect`, `SearchBar({value,onChange})`, `ViewControls({view,onViewChange,total,category,onCategoryChange})`, bulk endpoints).
- Produces: desktop master-detail on `/inventory`; deep link `/inventory?item=<id>`.

**Current page anatomy (for orientation):** default export at L110; state/hooks L111-127; bulk handlers L129-190; unauth return L192-213; authed return = `PageHeader` (L217-238, holds Export + Select buttons) → mobile `AskPorterBar` (L239-241, already `lg:hidden`) → filters block `SearchBar`+`ViewControls` (L242-249) → items grid with `isSelecting` button-wrap (L288-331) → `BulkActionBar` (L336) → `ExportActionSheet` (L349) → category modal (L357).

- [ ] **Step 1: Write the failing test — desktop selection drives the detail pane**

Create `apps/web/src/app/(tabs)/inventory/workbench.test.tsx` (ONE test). Follow the tab-page mock idiom from `app/(tabs)/orders/page.test.tsx` (hoisted hook mocks), and **stub ItemDetail** — its real dependency tree is irrelevant here:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import InventoryPage from "./page";

const h = vi.hoisted(() => ({
  items: [
    { id: "i1", title: "Strat", photos: [], condition: "good", category: "Guitars", listed: false },
    { id: "i2", title: "Tele", photos: [], condition: "good", category: "Guitars", listed: false },
  ],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/inventory",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "t" }),
}));
vi.mock("@/hooks/use-items", () => ({
  useItems: () => ({ items: h.items, total: 2, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-export", () => ({
  useExport: () => ({ exportItems: vi.fn(), isExporting: false }),
}));
vi.mock("@/components/porter/ask-porter-bar", () => ({
  AskPorterBar: () => <div data-testid="ask-porter-stub" />,
}));
vi.mock("@/components/inventory/item-detail", () => ({
  ItemDetail: ({ itemId }: { itemId: string }) => (
    <div data-testid="item-detail-stub">{itemId}</div>
  ),
}));

describe("Inventory workbench (lg master-detail)", () => {
  it("shows the empty hint, then renders the detail pane for a clicked item", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    expect(within(workbench).getByText(/select an item/i)).toBeInTheDocument();
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1");
  });
});
```

Adjust the mock import paths to the page's real imports (check the page's import block: `AskPorterBar` path, whether `use-messages`/`useUnreadCount` is pulled in via `PageHeader` — if PageHeader renders standalone in jsdom, no extra mock needed; if it throws on a missing provider, mock `@/hooks/use-unread-count` the same way `orders/page.test.tsx` does). jsdom renders both mobile and workbench DOM (no CSS breakpoints) — hence all queries scoped `within(workbench)`.

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- "src/app/(tabs)/inventory/workbench.test.tsx"`
Expected: FAIL — no `workbench` testid on the page.

- [ ] **Step 3: Implement — page restructure**

All edits in `app/(tabs)/inventory/page.tsx`:

**3a. New imports:**

```tsx
import { useEffect, useRef } from "react"; // extend existing react import
import type { Item } from "@/hooks/use-items";
import { ItemDetail } from "@/components/inventory/item-detail";
import { MasterDetail } from "@/components/workbench/master-detail";
import { useListNav } from "@/hooks/use-list-nav";
```

**3b. Selection state + deep link (after the existing state block, ~L127):**

```tsx
  // Workbench (lg+) selection. Deep link via history.replaceState — App Router
  // has no shallow routing; router.push would remount and refetch the page.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("item");
    if (id) setSelectedId(id);
  }, []);

  const selectItem = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `/inventory?item=${id}`);
  }, []);

  const clearSelection2 = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", "/inventory");
  }, []);

  const { onKeyDown: onListKeyDown } = useListNav({
    ids: items.map((i) => i.id),
    selectedId,
    onSelect: selectItem,
  });

  // Keep the selected card visible when arrow-keying.
  useEffect(() => {
    if (!selectedId) return;
    document
      .querySelector(`[data-item-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
```

(Name `clearSelection2` only if it collides with `clearSelection` from `useBulkSelect` — it does; rename to `clearDetailSelection` for readability. Use `clearDetailSelection` everywhere below.)

**3c. Extract `ItemsGrid`** — move the L288-331 grid block into a local component (same file, above the default export), parameterized for both surfaces:

```tsx
function ItemsGrid({
  items, view, isSelecting, selectedIds, onToggle, onOpen, selectedId,
}: {
  items: Item[];
  view: "grid" | "list";
  isSelecting: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
  selectedId?: string | null;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
          : "flex flex-col gap-2"
      }
    >
      {items.map((item) =>
        isSelecting ? (
          /* existing select-mode <button> wrapper block, verbatim (checkbox overlay + ring + <ItemCard item view />) */
          <button key={item.id} onClick={() => onToggle(item.id)} /* …existing markup… */>
            {/* …existing checkbox/ring markup unchanged… */}
            <ItemCard item={item} view={view} />
          </button>
        ) : (
          <ItemCard
            key={item.id}
            item={item}
            view={view}
            onOpen={onOpen ? () => onOpen(item.id) : undefined}
            selected={item.id === selectedId}
          />
        ),
      )}
    </div>
  );
}
```

The select-mode branch is moved verbatim from the current file (checkbox overlay SVG + ring div — copy as-is). Grid columns inside the 380px pane resolve to `grid-cols-2` (pane < md) — correct density for a list pane.

Replace the original L288-331 block in the mobile section with:

```tsx
<ItemsGrid items={items} view={view} isSelecting={isSelecting} selectedIds={selectedIds} onToggle={toggle} />
```

**3d. Split mobile vs workbench.** In the authed return:
- Wrap `PageHeader` + the filters block + the ItemsGrid section (everything except `AskPorterBar` [already `lg:hidden`], `BulkActionBar`, `ExportActionSheet`, and the category modal) in `<div className="lg:hidden">…</div>`. On desktop the TopBar already shows the page title (R0); Select/Export re-home into the workbench list pane header below. `BulkActionBar` + both sheets/modals stay OUTSIDE the wrapper (position-fixed overlays shared by both layouts).
- Append the workbench as a sibling:

```tsx
<MasterDetail
  listLabel="Inventory list"
  list={
    <div
      className="space-y-3 p-4 outline-none"
      tabIndex={0}
      onKeyDown={onListKeyDown}
      aria-label="Inventory items — use arrow keys to browse"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">{total} item{total !== 1 ? "s" : ""}</span>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <ExportButton />
            <button
              onClick={toggleSelecting}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelecting ? "bg-forest-green text-white" : "bg-muted text-text-secondary hover:text-text-primary"
              }`}
            >
              {isSelecting ? "Done" : "Select"}
            </button>
          </div>
        )}
      </div>
      <SearchBar value={search} onChange={setSearch} />
      <ViewControls view={view} onViewChange={setView} total={total} category={category} onCategoryChange={setCategory} />
      {/* reuse the page's existing loading / error / empty branches here, then: */}
      <ItemsGrid
        items={items}
        view={view}
        isSelecting={isSelecting}
        selectedIds={selectedIds}
        onToggle={toggle}
        onOpen={selectItem}
        selectedId={selectedId}
      />
    </div>
  }
  detail={
    selectedId ? (
      <ItemDetail
        key={selectedId}
        itemId={selectedId}
        variant="pane"
        onDeleted={() => {
          clearDetailSelection();
          refetch();
        }}
        onBack={clearDetailSelection}
      />
    ) : (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">Select an item to view and edit it</p>
      </div>
    )
  }
/>
```

`key={selectedId}` remounts the pane per item — resets photo-editor state, pending edits, and scroll. Search/category/view state is page-level, so mobile and workbench share one filter state and one `useItems` fetch (single `GET /items` — no duplicate requests).

**3e. Tab-bar clearance:** in `app/(tabs)/layout.tsx`, change `<main className="flex-1 pb-24">` → `<main className="flex-1 pb-24 lg:pb-0">` (the 6rem pad clears the floating mobile TabBar, which is `lg:hidden`; on desktop it would hollow out the workbench's bottom).

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- "src/app/(tabs)/inventory/workbench.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Add arrow-key test (red→green)**

Append ONE test:

```tsx
  it("moves selection with ArrowDown on the list pane", () => {
    render(<InventoryPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowDown" });
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i2");
  });
```

jsdom lacks `scrollIntoView` — if the effect throws, install the stub used by `app/inventory/[id]/page.test.tsx` (`Element.prototype.scrollIntoView = vi.fn()` in a `beforeEach`).

- [ ] **Step 6: Add deep-link test (red→green)**

Append ONE test:

```tsx
  it("selects the item from the ?item= deep link on mount", () => {
    window.history.replaceState(null, "", "/inventory?item=i2");
    render(<InventoryPage />);
    expect(
      within(screen.getByTestId("workbench")).getByTestId("item-detail-stub"),
    ).toHaveTextContent("i2");
  });
```

(Reset the URL in `afterEach`: `window.history.replaceState(null, "", "/")`.)

- [ ] **Step 7: Full suite + typecheck + lint**

Run: `npm run typecheck && npm run lint && npm run test -w apps/web`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(tabs)/inventory/page.tsx" "apps/web/src/app/(tabs)/inventory/workbench.test.tsx" "apps/web/src/app/(tabs)/layout.tsx"
git commit -m "feat(web): inventory desktop workbench — master-detail with arrow-key nav"
```

---

### Task 6: Listings workbench integration

**Files:**
- Modify: `apps/web/src/app/(tabs)/listings/page.tsx`
- Test: `apps/web/src/app/(tabs)/listings/workbench.test.tsx` (create)

**Interfaces:**
- Consumes: `ItemDetail`, `MasterDetail`, `useListNav` (Tasks 1–3); page's existing `useListings({status})`, local `ListingCard` (L40-106: computes `cardContent`, has an `isSelecting` button branch, else `<Link href={/inventory/${listing.itemId}?listing=${listing.id}}>`).
- Produces: desktop master-detail on `/listings` — selecting a listing shows its **item** in the pane with that listing focused (same target the mobile Link deep-links to).

- [ ] **Step 1: Write the failing test**

Create `workbench.test.tsx` (ONE test) — same idiom as Task 5 (mock `use-auth`, `use-listings` returning two listings `{ id: "l1", itemId: "i1", marketplace: "ebay", status: "active", price: 100, currency: "USD", itemTitle: "Strat", createdAt: …, updatedAt: … }` / `l2/i2/Tele`, stub `ItemDetail` capturing BOTH props, mock `next/navigation` + `AskPorterBar`):

```tsx
vi.mock("@/components/inventory/item-detail", () => ({
  ItemDetail: ({ itemId, focusListingId }: { itemId: string; focusListingId?: string | null }) => (
    <div data-testid="item-detail-stub">{itemId}:{focusListingId}</div>
  ),
}));

describe("Listings workbench (lg master-detail)", () => {
  it("opens the listing's item in the pane with the listing focused", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i1:l1");
  });
});
```

(Match the card's accessible name to the real `cardContent` markup — it renders `listing.itemTitle`; if the button's accessible name resolves differently, query by text within the button.)

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- "src/app/(tabs)/listings/workbench.test.tsx"`
Expected: FAIL — no workbench testid.

- [ ] **Step 3: Implement**

Mirror Task 5's structure exactly, adapted:

**3a. `ListingCard` gains workbench mode** (local component, L40-106). Add props `onOpen?: () => void; isActive?: boolean`, and a branch ABOVE the Link return:

```tsx
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-item-id={listing.id}
        aria-current={isActive ? "true" : undefined}
        className={`w-full text-left focus:outline-none ${isActive ? "ring-2 ring-forest-green rounded-xl" : ""}`}
      >
        {cardContent}
      </button>
    );
  }
```

**3b. Selection state** (after L115): `selectedListingId` state; `selectListing(id)` sets it + `history.replaceState(null, "", \`/listings?listing=${id}\`)`; `clearDetailSelection()` resets to `/listings`; mount-effect reads `?listing=`; `useListNav({ ids: listings.map(l => l.id), selectedId: selectedListingId, onSelect: selectListing })`; scroll-into-view effect on `[data-item-id="${selectedListingId}"]` — all verbatim from Task 5's Step 3b pattern with names swapped.

**3c. Split mobile vs workbench:** wrap `PageHeader` + status pills + grid in `<div className="lg:hidden">` (AskPorterBar already `lg:hidden`; `BulkListingBar` + confirm flows stay outside). Append sibling:

```tsx
const selectedListing = listings.find((l) => l.id === selectedListingId) ?? null;

<MasterDetail
  listLabel="Listings list"
  list={
    <div className="space-y-3 p-4 outline-none" tabIndex={0} onKeyDown={onListKeyDown} aria-label="Listings — use arrow keys to browse">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">{listings.length} listing{listings.length !== 1 ? "s" : ""}</span>
        {listings.length > 0 && (
          /* Select/Done button — copy of the PageHeader action block (L210-219) */
        )}
      </div>
      {/* status filter pills — reuse the same statusFilters map block (L227-241) */}
      {/* existing loading / error / empty branches */}
      <div className="grid grid-cols-1 gap-2">
        {listings.map((listing) =>
          /* existing isSelecting branch unchanged; else: */
          <ListingCard
            key={listing.id}
            listing={listing}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(listing.id)}
            onToggle={toggle}
            onOpen={() => selectListing(listing.id)}
            isActive={listing.id === selectedListingId}
          />,
        )}
      </div>
    </div>
  }
  detail={
    selectedListing ? (
      <ItemDetail
        key={selectedListing.id}
        itemId={selectedListing.itemId}
        focusListingId={selectedListing.id}
        variant="pane"
        onDeleted={() => { clearDetailSelection(); refetch(); }}
        onBack={clearDetailSelection}
      />
    ) : (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">Select a listing to view and edit it</p>
      </div>
    )
  }
/>
```

(Adapt the `ListingCard` call signature to the component's real prop names in the file — it currently receives `listing`, `isSelecting`, `isSelected`, `onToggle`; check L280-292 for the exact map call and extend it.) The status-pill grid in the pane stays single-column (`grid-cols-1`) — drop the `md:grid-cols-3 xl:grid-cols-4` there; the 380px pane is one column.

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- "src/app/(tabs)/listings/workbench.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Add arrow-key test (red→green)**

Append ONE test (same shape as Task 5 Step 5 — ArrowDown moves `l1 → l2`, stub shows `i2:l2`).

```tsx
  it("moves selection with ArrowDown on the list pane", () => {
    render(<ListingsPage />);
    const workbench = screen.getByTestId("workbench");
    fireEvent.click(within(workbench).getByRole("button", { name: /strat/i }));
    fireEvent.keyDown(within(workbench).getByLabelText(/arrow keys/i), { key: "ArrowDown" });
    expect(within(workbench).getByTestId("item-detail-stub")).toHaveTextContent("i2:l2");
  });
```

- [ ] **Step 6: Full suite + typecheck + lint**

Run: `npm run typecheck && npm run lint && npm run test -w apps/web`
Expected: clean. Also re-run the existing `listing-title.test.tsx` explicitly — it renders the whole page and must survive the restructure.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(tabs)/listings/page.tsx" "apps/web/src/app/(tabs)/listings/workbench.test.tsx"
git commit -m "feat(web): listings desktop workbench — master-detail with listing focus"
```

---

### Task 7: Live verification gate + docs + PR

**Files:**
- Modify: `docs/TODO.md` (check off Phase R1 line)

- [ ] **Step 1: Run the app from the worktree**

The main checkout's containers serve :3002; run the worktree's web app on a free port against the real API:

```bash
cd /home/swebber64/DHG/portage-ui-refactor
PORT=3003 npm run dev:web
```

(Real API on :8016 stays as-is — `.env` was copied into the worktree. If :3003 is occupied, take the next free port — never kill an occupant.)

- [ ] **Step 2: Observe real behavior at desktop width (frontend-verification gate — REQUIRED before any "done" claim)**

At `http://10.0.0.251:3003` in a ≥1280px window, with screenshots for each:

1. `/inventory` — two panes; left list scrolls independently; empty-state hint on the right.
2. Click an item — detail pane fills with the REAL item (photos load from R2, listings section populates via `GET /listings?itemId=`, comps section loads). No page navigation (URL becomes `/inventory?item=<id>` via replaceState).
3. Arrow keys — focus the list, ArrowDown/ArrowUp move selection, detail pane follows, selected card scrolls into view.
4. Edit a field in the pane (e.g. title) — `PATCH /items/:id` fires (network tab), item updates.
5. Delete an item from the pane — confirm modal, `DELETE /items/:id`, pane clears to hint, list refetches without the item.
6. `/listings` — select a listing → item detail opens with that listing's card highlighted/scrolled (focusListingId path).
7. Bulk mode on desktop — Select in the left pane header, checkboxes toggle, BulkActionBar appears, bulk delete round-trips `POST /items/bulk/delete`.
8. Narrow to <1024px — workbench disappears, original mobile flows intact (cards navigate to `/inventory/[id]` full page); confirm `/inventory/[id]` route still works standalone (Task 1 wrapper).
9. Deep links — paste `/inventory?item=<real-id>` and `/listings?listing=<real-id>` fresh: selection restores.

Every endpoint listed in Global Constraints must be observed firing (network tab) across steps 2–7 — full-stack wiring rule, no exceptions.

- [ ] **Step 3: Check off `docs/TODO.md`**

Phase R1 line → `- [x] Master-detail inventory/listings — list pane + edit pane (inventory/[id] surface), arrow-key nav, no page swaps` with `(PR #<n>, 2026-07-<dd>)` once the PR number exists.

```bash
git add docs/TODO.md
git commit -m "docs: check off Phase R1 desktop workbench"
```

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/ui-refactor
gh pr create --title "feat(web): R1 desktop workbench — master-detail inventory/listings" --body "<summary + verification evidence>"
```

CodeRabbit is a required check; auto-merge disabled — wait for review. Merge with `--no-ff` semantics per repo convention (merge commit via GitHub).

---

## Deferred (log to registry at execution time, not built now)

- Live list↔pane field sync — editing a title in the pane doesn't update the visible list card until refetch (only delete triggers refetch). Cosmetic staleness; revisit with pagination work.
- Selected item filtered out of the list (search change) keeps the detail pane open — harmless; decide behavior in R1 polish.
- `aria` listbox/option semantics for the list pane (currently `tabIndex=0` container + `aria-current` cards) — full roving-tabindex pattern deferred with the keyboard-shortcuts backlog item (`g i`, `/`, `n`).
- Enter-to-open on mobile-width keyboard users; Escape-to-clear selection.

## Self-Review Notes

- Spec coverage: R1 backlog line = list pane ✓ (Tasks 3/5/6) + edit pane on the `inventory/[id]` surface ✓ (Task 1 reuse, not a rebuild) + arrow-key nav ✓ (Tasks 2/5/6) + no page swaps ✓ (state + replaceState).
- Type consistency: `ItemDetailProps` (Task 1) matches every call site in Tasks 5/6 (`itemId`, `focusListingId`, `variant="pane"`, `onDeleted`, `onBack`); `useListNav` signature matches both pages; `ItemCard` `onOpen?: () => void` (thunk, not id-taking — pages close over `item.id`).
- Line numbers cited are from main @ 1f79f5c and drift as tasks land — treat as orientation, re-locate by content.
