# Onboarding Expansion — Tutorial Hub + Screenshot Show-and-Tell Implementation Plan

> **EXECUTED 2026-07-15** — shipped and merged as PR #231 (feat: onboarding expansion — tutorial hub + screenshot show-and-tell).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-viewable 8-topic tutorial hub with real app screenshots + in-app animated overlays, a scripted Playwright capture pipeline, and a screenshot-upgraded first-run carousel.

**Architecture:** Static TS content modules (one per topic, each also exporting a capture manifest) feed a client `TutorialPlayer` (device-framed screenshot + absolutely-positioned CSS-animated overlays). New routes `/tutorials` and `/tutorials/[topic]` live outside `(tabs)/`. A checked-in Playwright script regenerates `apps/web/public/tutorials/**` screenshots from the manifests. No DB or API changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`globals.css` keyframes), Vitest + Testing Library (jsdom), Playwright (capture script), tsx.

**Spec:** `docs/superpowers/specs/2026-07-14-onboarding-expansion-design.md` (branch `docs/onboarding-expansion-spec`, PR #228).

## Global Constraints

- Branch: `feat/onboarding-tutorials` off current `main`. (`feat/onboarding` already exists from PR #50 — do NOT reuse it.)
- tdd-guard is ACTIVE on apps/web: **one test per Write/Edit, red first**, then minimal implementation. Run tests with `npm run test -w apps/web -- <file>` (script already contains `run`). If the validator hedges, retry the same edit verbatim once. Prefer small Edits over full-file Writes.
- Stage **explicit paths only** — never `git add -u/-A` (Stephen's dirty CLAUDE.md files + untracked dirs are in the tree).
- No co-author trailers on commits.
- Direct push to main is hook-blocked; CodeRabbit is a required PR check; repo auto-merge disabled.
- Overlay coords are **% of screenshot natural size**, floats 0–100.
- Media: PNG screenshots + CSS/JS overlays only. **No GIF, no video.**
- Screenshot assets: `apps/web/public/tutorials/<topic>/<step-id>.png`, referenced as `/tutorials/<topic>/<step-id>.png`. Committed to git (baked into the image).
- Capture viewport: **390×844, deviceScaleFactor 2** (iPhone-class).
- All URLs use `10.0.0.251`, never localhost. App: `http://10.0.0.251:3002`. API: `https://10.0.0.251:8016`.
- Content modules must stay **React-free** (plain data + types) so the capture script can import them under tsx without JSX/DOM.
- Respect `prefers-reduced-motion` (CSS media query kills overlay animations).
- Design system: Forest Green `var(--forest-green)`, fonts `--font-instrument` (display) / `--font-plus-jakarta` (body), card idiom `rounded-2xl border border-border bg-surface` + `boxShadow: var(--shadow-subtle)`.
- Overlay coordinates written in Tasks 1–3 are **estimates**; Task 11 verifies them against real captured screenshots and adjusts. This is planned rework, not a defect.
- Capture script is NOT in CI (needs a running app).

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/lib/tutorials/types.ts` | Create — `Overlay`, `TutorialStep`, `TutorialTopic`, `CaptureAction`, `CaptureManifest` |
| `apps/web/src/lib/tutorials/{setup,adding-items,listings,inventory,orders,settings,porter,messages}.ts` | Create — one topic module each: topic content + capture manifest |
| `apps/web/src/lib/tutorials/index.ts` | Create — `TUTORIAL_TOPICS`, `CAPTURE_MANIFESTS`, `getTopic(slug)` |
| `apps/web/src/lib/tutorials/content.test.ts` | Create — schema validation across all topics |
| `apps/web/src/app/globals.css` | Modify — 4 tutorial overlay keyframes + reduced-motion guard |
| `apps/web/src/components/tutorials/device-frame.tsx` | Create — framed screenshot + overlay layer + placeholder fallback (shared with carousel) |
| `apps/web/src/components/tutorials/device-frame.test.tsx` | Create |
| `apps/web/src/components/tutorials/tutorial-player.tsx` | Create — step nav, dots, text, uses DeviceFrame |
| `apps/web/src/components/tutorials/tutorial-player.test.tsx` | Create |
| `apps/web/src/app/tutorials/page.tsx` | Create — hub: topic grid + Replay intro |
| `apps/web/src/app/tutorials/hub.test.tsx` | Create |
| `apps/web/src/app/tutorials/[topic]/page.tsx` | Create — player route, unknown slug → `notFound()` |
| `apps/web/src/app/tutorials/[topic]/topic-page.test.tsx` | Create |
| `apps/web/src/app/(tabs)/more/page.tsx` | Modify — Tutorials link |
| `apps/web/src/app/settings/help/page.tsx` | Modify — Tutorials link card |
| `apps/web/src/components/onboarding/onboarding-flow.tsx` | Modify — screenshots + overlay per step, secondary "Explore tutorials" |
| `apps/web/src/components/onboarding/onboarding-flow.test.tsx` | Modify — new behavior tests |
| `apps/web/src/app/(tabs)/home/page.tsx` | Modify — pass `onExploreTutorials` |
| `apps/web/scripts/capture-tutorials.ts` | Create — Playwright capture pipeline |
| `apps/web/package.json` | Modify — `capture:tutorials` script + `tsx` devDep |
| `package.json` (root) | Modify — `capture:tutorials` workspace alias |
| `apps/web/CLAUDE.md` | Modify — capture-rerun gotcha |

---

### Task 1: Types, registry skeleton, schema test harness, first topic (setup)

**Files:**
- Create: `apps/web/src/lib/tutorials/types.ts`
- Create: `apps/web/src/lib/tutorials/setup.ts`
- Create: `apps/web/src/lib/tutorials/index.ts`
- Test: `apps/web/src/lib/tutorials/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all later tasks rely on these exact names):
  - `types.ts`: `Overlay { type: "highlight"|"tap"|"callout"|"swipe"; x: number; y: number; w?: number; h?: number; text?: string; delay?: number }`, `TutorialStep { id: string; title: string; body: string; screenshot: string; overlays: Overlay[] }`, `TutorialTopic { slug: string; title: string; description: string; steps: TutorialStep[] }`, `CaptureAction = { type: "goto"; path: string } | { type: "click"; selector: string } | { type: "fill"; selector: string; value: string } | { type: "wait"; ms: number } | { type: "capture"; step: string }`, `CaptureManifest { topic: string; actions: CaptureAction[] }`
  - `index.ts`: `TUTORIAL_TOPICS: TutorialTopic[]` (final order: setup, adding-items, listings, inventory, orders, settings, porter, messages), `CAPTURE_MANIFESTS: CaptureManifest[]`, `getTopic(slug: string): TutorialTopic | undefined`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feat/onboarding-tutorials
```

- [ ] **Step 2: Write failing test — registry exposes the setup topic**

Create `apps/web/src/lib/tutorials/content.test.ts` (ONE test only — tdd-guard):

```typescript
import { describe, it, expect } from "vitest";
import { TUTORIAL_TOPICS, getTopic } from "./index";

describe("tutorial content registry", () => {
  it("exposes the setup topic via registry and getTopic", () => {
    expect(TUTORIAL_TOPICS.length).toBeGreaterThanOrEqual(1);
    expect(getTopic("setup")?.title).toBe("Get Set Up");
    expect(getTopic("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run — verify red**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 4: Implement types.ts + setup.ts + index.ts**

`apps/web/src/lib/tutorials/types.ts`:

```typescript
// Tutorial content model. Coords are % of the screenshot's natural size (0–100).
// These modules are imported by the Playwright capture script under tsx —
// keep them React-free (plain data only).

export type OverlayType = "highlight" | "tap" | "callout" | "swipe";

export interface Overlay {
  type: OverlayType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  delay?: number; // ms before the animation starts
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  screenshot: string; // public path, e.g. /tutorials/setup/connect-marketplaces.png
  overlays: Overlay[];
}

export interface TutorialTopic {
  slug: string;
  title: string;
  description: string;
  steps: TutorialStep[];
}

export type CaptureAction =
  | { type: "goto"; path: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "wait"; ms: number }
  | { type: "capture"; step: string };

export interface CaptureManifest {
  topic: string;
  actions: CaptureAction[];
}
```

`apps/web/src/lib/tutorials/setup.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const setupTopic: TutorialTopic = {
  slug: "setup",
  title: "Get Set Up",
  description: "Connect marketplaces, set seller defaults, pick a plan.",
  steps: [
    {
      id: "connect-marketplaces",
      title: "Connect your marketplaces",
      body: "Head to Settings → Marketplace Accounts and connect eBay and Reverb. Porter lists to every marketplace you connect — one flow, no re-typing.",
      screenshot: "/tutorials/setup/connect-marketplaces.png",
      overlays: [
        { type: "highlight", x: 10, y: 28, w: 80, h: 14 },
        { type: "callout", x: 50, y: 16, text: "Tap Connect on each marketplace", delay: 400 },
      ],
    },
    {
      id: "seller-profile",
      title: "Set your seller defaults",
      body: "Your return policy, shipping preferences, and item location live in Seller Profile. Set them once — every new listing inherits them automatically.",
      screenshot: "/tutorials/setup/seller-profile.png",
      overlays: [{ type: "highlight", x: 8, y: 20, w: 84, h: 30 }],
    },
    {
      id: "billing",
      title: "Pick your plan",
      body: "Billing & Plan shows your tier, usage, and credits. Upgrade any time — AI scans, background removal, and enhancements are metered by plan.",
      screenshot: "/tutorials/setup/billing.png",
      overlays: [{ type: "callout", x: 50, y: 30, text: "Your current plan and usage", delay: 300 }],
    },
  ],
};

export const setupManifest: CaptureManifest = {
  topic: "setup",
  actions: [
    { type: "goto", path: "/settings/marketplace" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "connect-marketplaces" },
    { type: "goto", path: "/settings/seller-profile" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "seller-profile" },
    { type: "goto", path: "/settings/billing" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "billing" },
  ],
};
```

`apps/web/src/lib/tutorials/index.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";
import { setupTopic, setupManifest } from "./setup";

export type { TutorialTopic, TutorialStep, Overlay, OverlayType, CaptureAction, CaptureManifest } from "./types";

export const TUTORIAL_TOPICS: TutorialTopic[] = [setupTopic];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [setupManifest];

export function getTopic(slug: string): TutorialTopic | undefined {
  return TUTORIAL_TOPICS.find((t) => t.slug === slug);
}
```

- [ ] **Step 5: Run — verify green**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: PASS.

- [ ] **Step 6: Add schema-validation tests ONE AT A TIME (red→green each)**

Append each `it` individually to `content.test.ts`, running the file between edits. These iterate the whole registry, so Tasks 2–3 content is automatically covered as it lands. All four tests go green against the existing setup topic immediately — that is fine; they are regression rails for Tasks 2–3 (tdd-guard accepts green guard tests added one at a time; if it objects, pair each with the module addition in Tasks 2–3 instead).

```typescript
  it("every overlay coordinate is within 0–100", () => {
    for (const topic of TUTORIAL_TOPICS)
      for (const step of topic.steps)
        for (const o of step.overlays) {
          expect(o.x, `${topic.slug}/${step.id}`).toBeGreaterThanOrEqual(0);
          expect(o.x).toBeLessThanOrEqual(100);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeLessThanOrEqual(100);
          if (o.w != null) expect(o.x + o.w).toBeLessThanOrEqual(100);
          if (o.h != null) expect(o.y + o.h).toBeLessThanOrEqual(100);
        }
  });

  it("every screenshot path lives under /tutorials/<slug>/", () => {
    for (const topic of TUTORIAL_TOPICS)
      for (const step of topic.steps)
        expect(step.screenshot, `${topic.slug}/${step.id}`).toMatch(
          new RegExp(`^/tutorials/${topic.slug}/[a-z0-9-]+\\.png$`),
        );
  });

  it("step ids are unique within each topic and non-empty", () => {
    for (const topic of TUTORIAL_TOPICS) {
      const ids = topic.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(topic.steps.length).toBeGreaterThan(0);
    }
  });

  it("every capture manifest's capture steps exactly match its topic's step ids", () => {
    for (const m of CAPTURE_MANIFESTS) {
      const topic = getTopic(m.topic);
      expect(topic, m.topic).toBeDefined();
      const captured = m.actions.filter((a) => a.type === "capture").map((a) => (a as { step: string }).step);
      expect(captured.sort()).toEqual(topic!.steps.map((s) => s.id).sort());
    }
  });
```

(Import `CAPTURE_MANIFESTS` in the test file's import line when adding the fourth test.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/tutorials/types.ts apps/web/src/lib/tutorials/setup.ts apps/web/src/lib/tutorials/index.ts apps/web/src/lib/tutorials/content.test.ts
git commit -m "feat(web): tutorial content model + setup topic + schema tests"
```

---

### Task 2: Topic modules — adding-items, listings, inventory

**Files:**
- Create: `apps/web/src/lib/tutorials/adding-items.ts`, `apps/web/src/lib/tutorials/listings.ts`, `apps/web/src/lib/tutorials/inventory.ts`
- Modify: `apps/web/src/lib/tutorials/index.ts`
- Test: `apps/web/src/lib/tutorials/content.test.ts`

**Interfaces:**
- Consumes: `types.ts` from Task 1.
- Produces: `addingItemsTopic`/`addingItemsManifest`, `listingsTopic`/`listingsManifest`, `inventoryTopic`/`inventoryManifest`; registry grows to 4 topics in order setup, adding-items, listings, inventory.

- [ ] **Step 1: Write failing test — registry contains 4 topics in order**

Append ONE test to `content.test.ts`:

```typescript
  it("registers adding-items, listings, inventory after setup", () => {
    expect(TUTORIAL_TOPICS.map((t) => t.slug)).toEqual([
      "setup",
      "adding-items",
      "listings",
      "inventory",
    ]);
  });
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: FAIL — array is `["setup"]`.

- [ ] **Step 3: Implement the three modules**

`apps/web/src/lib/tutorials/adding-items.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const addingItemsTopic: TutorialTopic = {
  slug: "adding-items",
  title: "Adding Items",
  description: "Scan with your camera or add items manually.",
  steps: [
    {
      id: "scan-home",
      title: "Scan anything",
      body: "Tap the green Scan button in the middle of the tab bar. Point your camera at an item — Porter's AI identifies it, estimates value, and drafts the details for you.",
      screenshot: "/tutorials/adding-items/scan-home.png",
      overlays: [{ type: "tap", x: 50, y: 93 }],
    },
    {
      id: "inventory-add",
      title: "Add photos your way",
      body: "Inside a scan you can add more shots from camera or gallery — up to 24 photos per item. Long-press any photo tile to drag it into a new order; the first photo is your hero shot.",
      screenshot: "/tutorials/adding-items/inventory-add.png",
      overlays: [{ type: "swipe", x: 30, y: 40, text: "Long-press, then drag" }],
    },
    {
      id: "item-detail",
      title: "Review and refine",
      body: "Every item gets a detail page: photos, condition, value estimate, and AI-drafted description. Edit anything — your input always wins over the AI's suggestion.",
      screenshot: "/tutorials/adding-items/item-detail.png",
      overlays: [{ type: "highlight", x: 6, y: 45, w: 88, h: 22 }],
    },
  ],
};

export const addingItemsManifest: CaptureManifest = {
  topic: "adding-items",
  actions: [
    { type: "goto", path: "/" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "scan-home" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "inventory-add" },
    { type: "click", selector: "[data-testid='item-card'], a[href^='/inventory/']" },
    { type: "wait", ms: 1200 },
    { type: "capture", step: "item-detail" },
  ],
};
```

`apps/web/src/lib/tutorials/listings.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const listingsTopic: TutorialTopic = {
  slug: "listings",
  title: "Listings",
  description: "Create, publish, and manage marketplace listings.",
  steps: [
    {
      id: "listings-tab",
      title: "All your listings, one place",
      body: "The Listings tab shows every active and sold listing across eBay and Reverb, with live status. No more juggling seller dashboards.",
      screenshot: "/tutorials/listings/listings-tab.png",
      overlays: [{ type: "highlight", x: 6, y: 18, w: 88, h: 30 }],
    },
    {
      id: "create-listing",
      title: "List in the style you like",
      body: "Create a listing conversationally with Porter, swipe through quick cards, or use the hybrid flow. Same result: title, description, pricing, and photos — AI-drafted, marketplace-ready.",
      screenshot: "/tutorials/listings/create-listing.png",
      overlays: [{ type: "callout", x: 50, y: 25, text: "Pick your flow — you can switch anytime", delay: 300 }],
    },
    {
      id: "manage-listing",
      title: "Edit from the item hub",
      body: "Tap any listing to open its item page — the single place to edit details, sync changes to the marketplace, or end a listing. Changes publish back with one tap.",
      screenshot: "/tutorials/listings/manage-listing.png",
      overlays: [{ type: "highlight", x: 6, y: 55, w: 88, h: 25 }],
    },
  ],
};

export const listingsManifest: CaptureManifest = {
  topic: "listings",
  actions: [
    { type: "goto", path: "/listings" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "listings-tab" },
    { type: "goto", path: "/list" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "create-listing" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 800 },
    { type: "click", selector: "[data-testid='item-card'], a[href^='/inventory/']" },
    { type: "wait", ms: 1200 },
    { type: "capture", step: "manage-listing" },
  ],
};
```

`apps/web/src/lib/tutorials/inventory.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const inventoryTopic: TutorialTopic = {
  slug: "inventory",
  title: "Inventory",
  description: "Browse, search, and bulk-manage your catalog.",
  steps: [
    {
      id: "browse",
      title: "Your personal catalog",
      body: "Everything you've scanned lives in Inventory — with photos, values, and listing status. Grid or list view, your choice.",
      screenshot: "/tutorials/inventory/browse.png",
      overlays: [{ type: "highlight", x: 6, y: 22, w: 88, h: 40 }],
    },
    {
      id: "search",
      title: "Find anything fast",
      body: "Search by name, filter by status, sort by value or date. The Unlisted badge shows what's sitting idle — your next listing candidates.",
      screenshot: "/tutorials/inventory/search.png",
      overlays: [{ type: "tap", x: 50, y: 14 }],
    },
    {
      id: "bulk",
      title: "Bulk actions",
      body: "Select multiple items to archive, activate, delete, or export as an eBay-ready CSV in one move.",
      screenshot: "/tutorials/inventory/bulk.png",
      overlays: [{ type: "callout", x: 50, y: 80, text: "Select items → bulk bar appears", delay: 300 }],
    },
  ],
};

export const inventoryManifest: CaptureManifest = {
  topic: "inventory",
  actions: [
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "browse" },
    { type: "click", selector: "input[type='search'], [placeholder*='Search']" },
    { type: "wait", ms: 400 },
    { type: "capture", step: "search" },
    { type: "goto", path: "/inventory" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "bulk" },
  ],
};
```

In `index.ts`, extend imports and arrays:

```typescript
import { addingItemsTopic, addingItemsManifest } from "./adding-items";
import { listingsTopic, listingsManifest } from "./listings";
import { inventoryTopic, inventoryManifest } from "./inventory";

export const TUTORIAL_TOPICS: TutorialTopic[] = [setupTopic, addingItemsTopic, listingsTopic, inventoryTopic];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [setupManifest, addingItemsManifest, listingsManifest, inventoryManifest];
```

- [ ] **Step 4: Run full content test file — verify green (schema rails included)**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tutorials/adding-items.ts apps/web/src/lib/tutorials/listings.ts apps/web/src/lib/tutorials/inventory.ts apps/web/src/lib/tutorials/index.ts apps/web/src/lib/tutorials/content.test.ts
git commit -m "feat(web): tutorial topics — adding-items, listings, inventory"
```

---

### Task 3: Topic modules — orders, settings, porter, messages (registry complete)

**Files:**
- Create: `apps/web/src/lib/tutorials/orders.ts`, `apps/web/src/lib/tutorials/settings.ts`, `apps/web/src/lib/tutorials/porter.ts`, `apps/web/src/lib/tutorials/messages.ts`
- Modify: `apps/web/src/lib/tutorials/index.ts`
- Test: `apps/web/src/lib/tutorials/content.test.ts`

**Interfaces:**
- Produces: full 8-topic registry in final order: setup, adding-items, listings, inventory, orders, settings, porter, messages.

- [ ] **Step 1: Update the order test (red)**

Edit the Task 2 order test in place to the full list:

```typescript
  it("registers all 8 topics in hub order", () => {
    expect(TUTORIAL_TOPICS.map((t) => t.slug)).toEqual([
      "setup",
      "adding-items",
      "listings",
      "inventory",
      "orders",
      "settings",
      "porter",
      "messages",
    ]);
  });
```

(Replace the previous `registers adding-items…` test — same `it`, new name+body. tdd-guard: this is one test edit.)

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: FAIL — 4 slugs vs 8.

- [ ] **Step 3: Implement the four modules**

`apps/web/src/lib/tutorials/orders.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const ordersTopic: TutorialTopic = {
  slug: "orders",
  title: "Orders",
  description: "Track sales and ship with marketplace labels.",
  steps: [
    {
      id: "orders-tab",
      title: "Sales from every marketplace",
      body: "When something sells, it lands here — buyer, price, and date, synced automatically from eBay and Reverb.",
      screenshot: "/tutorials/orders/orders-tab.png",
      overlays: [{ type: "highlight", x: 6, y: 20, w: 88, h: 30 }],
    },
    {
      id: "order-detail",
      title: "Everything about the sale",
      body: "Open an order for the full picture: item, shipping address, and payout. Mark it shipped once the label is on the box.",
      screenshot: "/tutorials/orders/order-detail.png",
      overlays: [{ type: "highlight", x: 6, y: 30, w: 88, h: 35 }],
    },
    {
      id: "ship-it",
      title: "Ship It",
      body: "The Ship It button takes you straight to the marketplace's label purchase page with the order pre-selected — cheapest rates, no re-typing addresses.",
      screenshot: "/tutorials/orders/ship-it.png",
      overlays: [{ type: "tap", x: 50, y: 75 }],
    },
  ],
};

export const ordersManifest: CaptureManifest = {
  topic: "orders",
  actions: [
    { type: "goto", path: "/orders" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "orders-tab" },
    { type: "click", selector: "[data-testid='order-row'], a[href^='/orders/']" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "order-detail" },
    { type: "capture", step: "ship-it" },
  ],
};
```

(Orders may be empty on the demo account — the empty state is still a valid screenshot; copy above reads correctly either way. If `click` finds no order row, the capture script logs and reuses the tab screenshot for detail steps — see Task 10.)

`apps/web/src/lib/tutorials/settings.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const settingsTopic: TutorialTopic = {
  slug: "settings",
  title: "Settings Tour",
  description: "Profile, marketplaces, billing, notifications, help.",
  steps: [
    {
      id: "more-tab",
      title: "Everything lives under More",
      body: "Profile, Billing & Plan, Marketplace Accounts, Messages, Seller Profile, Notifications, and Help — all one tap from the More tab.",
      screenshot: "/tutorials/settings/more-tab.png",
      overlays: [{ type: "highlight", x: 6, y: 30, w: 88, h: 45 }],
    },
    {
      id: "marketplace-accounts",
      title: "Marketplace connections",
      body: "See connection status at a glance, reconnect if a token expires, or add a new marketplace as we launch them.",
      screenshot: "/tutorials/settings/marketplace-accounts.png",
      overlays: [{ type: "highlight", x: 8, y: 25, w: 84, h: 25 }],
    },
    {
      id: "help",
      title: "Help when you need it",
      body: "FAQs, support contact, and these tutorials — all under Help & Support. We typically respond within 24 hours.",
      screenshot: "/tutorials/settings/help.png",
      overlays: [{ type: "callout", x: 50, y: 25, text: "Come back to tutorials anytime", delay: 300 }],
    },
  ],
};

export const settingsManifest: CaptureManifest = {
  topic: "settings",
  actions: [
    { type: "goto", path: "/more" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "more-tab" },
    { type: "goto", path: "/settings/marketplace" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "marketplace-accounts" },
    { type: "goto", path: "/settings/help" },
    { type: "wait", ms: 800 },
    { type: "capture", step: "help" },
  ],
};
```

`apps/web/src/lib/tutorials/porter.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const porterTopic: TutorialTopic = {
  slug: "porter",
  title: "Porter AI",
  description: "Your selling assistant — ask anything about your inventory.",
  steps: [
    {
      id: "porter-tab",
      title: "Meet Porter",
      body: "Porter is your AI selling assistant. Ask about your inventory, get stats, or have it suggest what to list next — in plain English.",
      screenshot: "/tutorials/porter/porter-tab.png",
      overlays: [{ type: "callout", x: 50, y: 40, text: "Ask anything about your items", delay: 300 }],
    },
    {
      id: "porter-ask",
      title: "Ask in your own words",
      body: "“What's my most valuable unlisted item?” “How many guitars do I have?” Porter searches your real inventory and answers with the data.",
      screenshot: "/tutorials/porter/porter-ask.png",
      overlays: [{ type: "highlight", x: 6, y: 85, w: 88, h: 10 }],
    },
    {
      id: "action-pills",
      title: "Act on the answer",
      body: "Porter's replies include action pills — tap one to jump straight to the item, start a listing, or open your stats. Conversation to action in one tap.",
      screenshot: "/tutorials/porter/action-pills.png",
      overlays: [{ type: "tap", x: 30, y: 70 }],
    },
  ],
};

export const porterManifest: CaptureManifest = {
  topic: "porter",
  actions: [
    { type: "goto", path: "/porter" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "porter-tab" },
    { type: "fill", selector: "textarea, input[type='text']", value: "What's my most valuable unlisted item?" },
    { type: "wait", ms: 400 },
    { type: "capture", step: "porter-ask" },
    { type: "capture", step: "action-pills" },
  ],
};
```

(Porter capture types the question but never sends — no live AI call in the pipeline. `action-pills` initially reuses that frame; if a canned conversation exists on the demo account it captures that instead. Coords verified in Task 11.)

`apps/web/src/lib/tutorials/messages.ts`:

```typescript
import type { TutorialTopic, CaptureManifest } from "./types";

export const messagesTopic: TutorialTopic = {
  slug: "messages",
  title: "Messages",
  description: "Buyer conversations from eBay, answered in-app.",
  steps: [
    {
      id: "conversations",
      title: "Buyer messages, in one inbox",
      body: "eBay buyer messages sync into Portage. Unread counts show on the More tab so nothing slips.",
      screenshot: "/tutorials/messages/conversations.png",
      overlays: [{ type: "highlight", x: 6, y: 20, w: 88, h: 30 }],
    },
    {
      id: "thread",
      title: "Full conversation view",
      body: "Open a conversation to see the whole thread with the item attached for context.",
      screenshot: "/tutorials/messages/thread.png",
      overlays: [{ type: "highlight", x: 6, y: 25, w: 88, h: 45 }],
    },
    {
      id: "reply",
      title: "Reply without leaving",
      body: "Type your reply right here — it's delivered to the buyer through eBay. No dashboard hopping.",
      screenshot: "/tutorials/messages/reply.png",
      overlays: [{ type: "tap", x: 50, y: 90 }],
    },
  ],
};

export const messagesManifest: CaptureManifest = {
  topic: "messages",
  actions: [
    { type: "goto", path: "/messages" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "conversations" },
    { type: "click", selector: "[data-testid='conversation-row'], a[href^='/messages/']" },
    { type: "wait", ms: 1000 },
    { type: "capture", step: "thread" },
    { type: "capture", step: "reply" },
  ],
};
```

Extend `index.ts` (final form of the two arrays):

```typescript
import { ordersTopic, ordersManifest } from "./orders";
import { settingsTopic, settingsManifest } from "./settings";
import { porterTopic, porterManifest } from "./porter";
import { messagesTopic, messagesManifest } from "./messages";

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  setupTopic, addingItemsTopic, listingsTopic, inventoryTopic,
  ordersTopic, settingsTopic, porterTopic, messagesTopic,
];

export const CAPTURE_MANIFESTS: CaptureManifest[] = [
  setupManifest, addingItemsManifest, listingsManifest, inventoryManifest,
  ordersManifest, settingsManifest, porterManifest, messagesManifest,
];
```

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: PASS (order + all schema rails across 8 topics).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tutorials/orders.ts apps/web/src/lib/tutorials/settings.ts apps/web/src/lib/tutorials/porter.ts apps/web/src/lib/tutorials/messages.ts apps/web/src/lib/tutorials/index.ts apps/web/src/lib/tutorials/content.test.ts
git commit -m "feat(web): tutorial topics — orders, settings, porter, messages (registry complete)"
```

---

### Task 4: Overlay keyframes + DeviceFrame component

**Files:**
- Modify: `apps/web/src/app/globals.css` (append after the existing keyframes block, ~line 270)
- Create: `apps/web/src/components/tutorials/device-frame.tsx`
- Test: `apps/web/src/components/tutorials/device-frame.test.tsx`

**Interfaces:**
- Consumes: `Overlay` from `@/lib/tutorials`.
- Produces: `DeviceFrame({ screenshot, overlays, animationKey, alt, compact? })` — `animationKey: string | number` re-triggers overlay animations on step change; `compact` shrinks the frame for the carousel. Placeholder fallback on image error (`data-testid="device-frame-placeholder"`). Overlay nodes carry `data-testid="tutorial-overlay"` and class `tutorial-overlay`.

**Height budget (adversarial-review fix):** `compact` is `w-28` (112px wide → ~242px tall at 844/390 aspect). The onboarding card is `max-h-[90dvh]` — on a 375×667 viewport that is ~600px for skip + frame + title + subtitle + body + dots + nav. 242px keeps the CTA above the fold; do NOT widen compact past `w-32` without re-checking the 375×667 walk in Task 11.

**A11y note (documented choice):** the overlay layer (incl. callout text) is `aria-hidden` — callout copy always duplicates information already present in the step's `body` text, which screen readers get. Keep that duplication rule when writing future topics.

- [ ] **Step 1: Write failing test — renders screenshot + overlays**

Create `device-frame.test.tsx` (ONE test):

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeviceFrame } from "./device-frame";

describe("DeviceFrame", () => {
  it("renders the screenshot and one node per overlay", () => {
    render(
      <DeviceFrame
        screenshot="/tutorials/setup/billing.png"
        overlays={[
          { type: "highlight", x: 10, y: 20, w: 50, h: 10 },
          { type: "tap", x: 50, y: 90 },
        ]}
        animationKey={0}
        alt="Billing settings"
      />,
    );
    expect(screen.getByRole("img", { name: "Billing settings" })).toHaveAttribute(
      "src",
      "/tutorials/setup/billing.png",
    );
    expect(screen.getAllByTestId("tutorial-overlay")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/tutorials/device-frame.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Append keyframes to `globals.css`**

```css
/* Tutorial overlay animations (TutorialPlayer / onboarding carousel) */
@keyframes tutorial-pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(45, 90, 39, 0.55); }
  50% { box-shadow: 0 0 0 10px rgba(45, 90, 39, 0); }
}

@keyframes tutorial-tap-ripple {
  0% { transform: scale(0.5); opacity: 0.85; }
  100% { transform: scale(1.8); opacity: 0; }
}

@keyframes tutorial-callout-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes tutorial-swipe-x {
  0% { transform: translateX(-10px); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateX(18px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .tutorial-overlay { animation: none !important; }
}
```

- [ ] **Step 4: Implement `device-frame.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Overlay } from "@/lib/tutorials";

interface DeviceFrameProps {
  screenshot: string;
  overlays: Overlay[];
  animationKey: string | number;
  alt: string;
  compact?: boolean;
}

function overlayStyle(o: Overlay): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: `${o.x}%`,
    top: `${o.y}%`,
    animationDelay: o.delay ? `${o.delay}ms` : undefined,
  };
  if (o.type === "highlight") {
    return {
      ...base,
      width: `${o.w ?? 20}%`,
      height: `${o.h ?? 10}%`,
      borderRadius: "12px",
      border: "2px solid var(--forest-green)",
      animation: "tutorial-pulse-ring 1.6s ease-out infinite",
    };
  }
  if (o.type === "tap") {
    return {
      ...base,
      width: "36px",
      height: "36px",
      marginLeft: "-18px",
      marginTop: "-18px",
      borderRadius: "50%",
      background: "rgba(45, 90, 39, 0.45)",
      animation: "tutorial-tap-ripple 1.4s ease-out infinite",
    };
  }
  if (o.type === "swipe") {
    return {
      ...base,
      animation: "tutorial-swipe-x 1.6s ease-in-out infinite",
    };
  }
  // callout
  return {
    ...base,
    transform: "translateX(-50%)",
    maxWidth: "80%",
    animation: "tutorial-callout-in 0.4s ease-out both",
  };
}

export function DeviceFrame({ screenshot, overlays, animationKey, alt, compact }: DeviceFrameProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-[2rem] border-[6px] bg-black ${compact ? "w-28" : "w-full max-w-[280px]"}`}
      style={{ borderColor: "#1a1a1a", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
      {/* Screenshot area — 390×844 aspect via padding trick (iOS aspect-ratio collapse gotcha) */}
      <div className="relative w-full" style={{ paddingBottom: `${(844 / 390) * 100}%` }}>
        {failed ? (
          <div
            data-testid="device-frame-placeholder"
            className="absolute inset-0 flex items-center justify-center bg-muted"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Screenshot unavailable">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- static tutorial asset, natural-size coords depend on raw img */}
            <img
              src={screenshot}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
            <div key={animationKey} className="absolute inset-0" aria-hidden="true">
              {overlays.map((o, i) => (
                <div key={i} data-testid="tutorial-overlay" className="tutorial-overlay" style={overlayStyle(o)}>
                  {o.type === "callout" && o.text && (
                    <span
                      className="block rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
                      style={{ background: "var(--forest-green)" }}
                    >
                      {o.text}
                    </span>
                  )}
                  {o.type === "swipe" && (
                    <svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="var(--forest-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 10h30M26 4l6 6-6 6" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run — verify green**

Run: `npm run test -w apps/web -- src/components/tutorials/device-frame.test.tsx`
Expected: PASS.

- [ ] **Step 6: Add remaining tests ONE AT A TIME (red→green each)**

Test 2 — placeholder fallback:

```typescript
  it("swaps to a placeholder frame when the screenshot fails to load", () => {
    render(
      <DeviceFrame screenshot="/tutorials/missing.png" overlays={[]} animationKey={0} alt="Missing" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Missing" }));
    expect(screen.getByTestId("device-frame-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Missing" })).not.toBeInTheDocument();
  });
```

(Add `fireEvent` to the testing-library import.)

Test 3 — callout text renders:

```typescript
  it("renders callout text", () => {
    render(
      <DeviceFrame
        screenshot="/tutorials/setup/billing.png"
        overlays={[{ type: "callout", x: 50, y: 30, text: "Your current plan" }]}
        animationKey={0}
        alt="Billing"
      />,
    );
    expect(screen.getByText("Your current plan")).toBeInTheDocument();
  });
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/tutorials/device-frame.tsx apps/web/src/components/tutorials/device-frame.test.tsx
git commit -m "feat(web): DeviceFrame — framed screenshot + animated tutorial overlays"
```

---

### Task 5: TutorialPlayer

**Files:**
- Create: `apps/web/src/components/tutorials/tutorial-player.tsx`
- Test: `apps/web/src/components/tutorials/tutorial-player.test.tsx`

**Interfaces:**
- Consumes: `DeviceFrame` (Task 4), `TutorialTopic` (Task 1).
- Produces: `TutorialPlayer({ topic }: { topic: TutorialTopic })`. Buttons named "Next" / "Back"; progress dots `aria-hidden`; step title in an `h2`.

- [ ] **Step 1: Write failing test — renders first step**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TutorialPlayer } from "./tutorial-player";
import type { TutorialTopic } from "@/lib/tutorials";

const topic: TutorialTopic = {
  slug: "demo",
  title: "Demo Topic",
  description: "d",
  steps: [
    { id: "one", title: "Step One", body: "First body", screenshot: "/tutorials/demo/one.png", overlays: [] },
    { id: "two", title: "Step Two", body: "Second body", screenshot: "/tutorials/demo/two.png", overlays: [{ type: "tap", x: 50, y: 50 }] },
  ],
};

describe("TutorialPlayer", () => {
  it("renders the first step's title, body, and screenshot", () => {
    render(<TutorialPlayer topic={topic} />);
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
    expect(screen.getByText("First body")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Step One" })).toHaveAttribute("src", "/tutorials/demo/one.png");
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/tutorials/tutorial-player.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tutorial-player.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import type { TutorialTopic } from "@/lib/tutorials";
import { DeviceFrame } from "./device-frame";

interface TutorialPlayerProps {
  topic: TutorialTopic;
}

export function TutorialPlayer({ topic }: TutorialPlayerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = topic.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === topic.steps.length - 1;

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, topic.steps.length - 1));
  }, [topic.steps.length]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-6">
      <DeviceFrame
        screenshot={step.screenshot}
        overlays={step.overlays}
        animationKey={step.id}
        alt={step.title}
      />

      <div className="mt-6 w-full text-center">
        <h2
          className="font-[family-name:var(--font-instrument)] font-bold text-text-primary"
          style={{ fontSize: "var(--text-title)" }}
        >
          {step.title}
        </h2>
        <p
          className="mt-2 font-[family-name:var(--font-plus-jakarta)] leading-relaxed text-text-secondary"
          style={{ fontSize: "var(--text-body)" }}
        >
          {step.body}
        </p>
      </div>

      {/* Dot indicators — same pattern as onboarding-flow.tsx */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {topic.steps.map((s, i) => (
          <div
            key={s.id}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === stepIndex ? "20px" : "6px",
              height: "6px",
              background: i === stepIndex ? "var(--forest-green)" : "var(--border)",
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mt-5 flex w-full items-center gap-3">
        {!isFirst && (
          <button
            onClick={goPrev}
            className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-muted"
          >
            Back
          </button>
        )}
        {!isLast && (
          <button
            onClick={goNext}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: "var(--forest-green)" }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/components/tutorials/tutorial-player.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add remaining tests ONE AT A TIME (red→green each)**

Test 2 — Next advances and renders step 2's overlay:

```typescript
  it("advances to the next step on Next and renders its overlays", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Step Two" })).toBeInTheDocument();
    expect(screen.getAllByTestId("tutorial-overlay")).toHaveLength(1);
  });
```

Test 3 — Back returns; Back hidden on first step:

```typescript
  it("goes back with Back, which is hidden on the first step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Step One" })).toBeInTheDocument();
  });
```

Test 4 — Next hidden on last step:

```typescript
  it("hides Next on the last step", async () => {
    const user = userEvent.setup();
    render(<TutorialPlayer topic={topic} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tutorials/tutorial-player.tsx apps/web/src/components/tutorials/tutorial-player.test.tsx
git commit -m "feat(web): TutorialPlayer — step navigation over device-framed screenshots"
```

---

### Task 6: Tutorial hub page `/tutorials`

**Files:**
- Create: `apps/web/src/app/tutorials/page.tsx`
- Test: `apps/web/src/app/tutorials/hub.test.tsx`

**Interfaces:**
- Consumes: `TUTORIAL_TOPICS` (Task 1/3), `OnboardingFlow` (existing — replay uses its current 3-prop signature; Task 9 extends it compatibly).
- Produces: hub route with topic cards (`<Link href="/tutorials/<slug>">`) and a "Replay intro" button that mounts `OnboardingFlow` WITHOUT touching the completed flag.

- [ ] **Step 1: Write failing test — renders all 8 topic cards**

Create `apps/web/src/app/tutorials/hub.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TutorialsHubPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

describe("Tutorials hub", () => {
  it("renders a card linking to every tutorial topic", () => {
    render(<TutorialsHubPage />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    for (const slug of ["setup", "adding-items", "listings", "inventory", "orders", "settings", "porter", "messages"]) {
      expect(hrefs).toContain(`/tutorials/${slug}`);
    }
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/app/tutorials/hub.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TUTORIAL_TOPICS } from "@/lib/tutorials";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  setup: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  "adding-items": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  listings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  orders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  porter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 017 7v3a7 7 0 01-14 0V9a7 7 0 017-7z" />
      <circle cx="9" cy="11" r="1" />
      <circle cx="15" cy="11" r="1" />
    </svg>
  ),
  messages: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
};

export default function TutorialsHubPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => router.back()} className="-ml-1 p-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">Tutorials</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-2 px-4 py-6">
        {TUTORIAL_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/tutorials/${topic.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-muted"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-forest-green-50">
              {TOPIC_ICONS[topic.slug]}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-text-primary">{topic.title}</h3>
              <p className="mt-0.5 text-xs text-text-secondary">{topic.description}</p>
            </div>
            <span className="flex-shrink-0 text-xs text-text-placeholder">{topic.steps.length} steps</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}

        <div className="pt-4">
          <button
            onClick={() => setShowIntro(true)}
            className="w-full rounded-2xl border border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-muted"
          >
            Replay intro
          </button>
        </div>
      </div>

      {showIntro && (
        <OnboardingFlow
          onComplete={async () => setShowIntro(false)}
          onSkip={async () => setShowIntro(false)}
          isCompleting={false}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/app/tutorials/hub.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add replay-intro test ONE AT A TIME (red→green)**

```typescript
  it("Replay intro mounts the onboarding carousel without completing onboarding", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TutorialsHubPage />);
    await user.click(screen.getByRole("button", { name: "Replay intro" }));
    expect(screen.getByRole("dialog", { name: "Portage onboarding" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip onboarding" }));
    expect(screen.queryByRole("dialog", { name: "Portage onboarding" })).not.toBeInTheDocument();
  });
```

(Move the `userEvent` import to the top of the file with the others when adding this test.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/tutorials/page.tsx apps/web/src/app/tutorials/hub.test.tsx
git commit -m "feat(web): /tutorials hub — topic grid + replay intro"
```

---

### Task 7: Topic route `/tutorials/[topic]`

**Files:**
- Create: `apps/web/src/app/tutorials/[topic]/page.tsx`
- Test: `apps/web/src/app/tutorials/[topic]/topic-page.test.tsx`

**Interfaces:**
- Consumes: `getTopic` (Task 1), `TutorialPlayer` (Task 5).
- Produces: server-component page; unknown slug → `notFound()`. Next 16: `params` is a Promise.

**Spike risk (adversarial-review flag):** this is the FIRST async server-component page in the codebase — every existing `page.tsx` is `"use client"`; the closest analog `apps/web/src/app/orders/[id]/page.tsx` unwraps `params` client-side via `use()` + `<Suspense>`. The `render(await Page(...))` test technique has no repo precedent. If the red-first run fails with anything other than "module not found", STOP — do not iterate on the test. Fallback: convert the page to the proven `orders/[id]` shape (`"use client"`, `use(params)`, Suspense) and test it like `orders/[id]/page.test.tsx` does.

- [ ] **Step 1: Write failing test — known slug renders, unknown 404s**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

import TutorialTopicPage from "./page";

describe("/tutorials/[topic]", () => {
  it("renders the player for a known slug and 404s an unknown one", async () => {
    render(await TutorialTopicPage({ params: Promise.resolve({ topic: "setup" }) }));
    expect(screen.getByRole("heading", { name: "Get Set Up" })).toBeInTheDocument();

    await expect(
      TutorialTopicPage({ params: Promise.resolve({ topic: "bogus" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- "src/app/tutorials/[topic]/topic-page.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopic, TUTORIAL_TOPICS } from "@/lib/tutorials";
import { TutorialPlayer } from "@/components/tutorials/tutorial-player";

export function generateStaticParams() {
  return TUTORIAL_TOPICS.map((t) => ({ topic: t.slug }));
}

export default async function TutorialTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/tutorials" className="-ml-1 p-1" aria-label="Back to tutorials">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">
            {topic.title}
          </h1>
        </div>
      </header>
      <TutorialPlayer topic={topic} />
    </div>
  );
}
```

(Note: the player's step title renders as the `h2` heading "Get Set Up" is the page `h1` — the test asserts the `h1`; both resolve via `getByRole("heading")`. The `heading` query matches the `h1` here.)

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- "src/app/tutorials/[topic]/topic-page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/tutorials/[topic]/page.tsx" "apps/web/src/app/tutorials/[topic]/topic-page.test.tsx"
git commit -m "feat(web): /tutorials/[topic] route with notFound guard"
```

---

### Task 8: Entry points — More tab + Help page

**Files:**
- Modify: `apps/web/src/app/(tabs)/more/page.tsx` (insert a `SettingsLink` before the Help link, ~line 145)
- Modify: `apps/web/src/app/settings/help/page.tsx` (insert a Tutorials card above Contact, ~line 44)

**Interfaces:**
- Consumes: hub route from Task 6.
- Produces: two navigation entry points. (Third entry point — onboarding final step — lands in Task 9.)

No new logic — these are declarative `Link` insertions; the hub's own tests cover the destination. `settings/help/page.test.tsx` exists (one FAQ-render test — verified unaffected by inserting the Tutorials card); `more/page.tsx` has no test file. Verify by render in Task 11's app walk. tdd-guard permits non-test-first edits only when no behavior test applies; if the guard objects, add a smoke test asserting the link renders in `more/page` (it has heavy hook deps — mock `useAuth`/`useUnreadCount` as in the pattern below).

- [ ] **Step 1: More tab — insert before the Help & Support `SettingsLink`**

```tsx
          <SettingsLink
            href="/tutorials"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
              </svg>
            }
            title="Tutorials"
            description="Learn Portage step by step"
          />
```

- [ ] **Step 2: Help page — insert card above Contact Support**

```tsx
        {/* Tutorials */}
        <Link
          href="/tutorials"
          className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-muted"
          style={{ boxShadow: "var(--shadow-subtle)" }}
        >
          <h2 className="text-sm font-semibold text-text-primary mb-1">Tutorials</h2>
          <p className="text-xs text-text-secondary">Step-by-step walkthroughs of every part of Portage.</p>
        </Link>
```

(Add `import Link from "next/link";` to the help page imports.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(tabs)/more/page.tsx" apps/web/src/app/settings/help/page.tsx
git commit -m "feat(web): tutorials entry points — More tab + Help page"
```

---

### Task 9: First-run carousel upgrade

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-flow.tsx`
- Modify: `apps/web/src/app/(tabs)/home/page.tsx` (~line 455 — OnboardingFlow mount)
- Test: `apps/web/src/components/onboarding/onboarding-flow.test.tsx`

**Interfaces:**
- Consumes: `DeviceFrame` (Task 4), tutorial screenshots (paths only — assets land in Task 11).
- Produces: `OnboardingFlowProps` gains optional `onExploreTutorials?: () => void`. Step model swaps `icon: React.ReactNode` for `screenshot: string; overlays: Overlay[]`. Keep 5 steps, copy, skip/back/next, slide animation, completion flow.

- [ ] **Step 1: Write failing test — steps render device-framed screenshots**

Append ONE test to `onboarding-flow.test.tsx`:

```typescript
  it("renders a device-framed screenshot instead of an icon block", () => {
    render(
      <OnboardingFlow onComplete={vi.fn()} onSkip={vi.fn()} isCompleting={false} />,
    );
    expect(screen.getByRole("img", { name: "Welcome to Portage" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run — verify red**

Run: `npm run test -w apps/web -- src/components/onboarding/onboarding-flow.test.tsx`
Expected: FAIL — no img role.

- [ ] **Step 3: Implement — swap icon block for compact DeviceFrame**

In `onboarding-flow.tsx`:

1. Add imports:

```tsx
import { DeviceFrame } from "@/components/tutorials/device-frame";
import type { Overlay } from "@/lib/tutorials";
```

2. Change the props interface:

```tsx
interface OnboardingFlowProps {
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  isCompleting: boolean;
  onExploreTutorials?: () => void;
}
```

3. Replace the `Step` interface and delete `EbayIcon`/`ReverbIcon`:

```tsx
interface Step {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  screenshot: string;
  overlays: Overlay[];
}
```

4. Replace each step's `icon:` field (titles/subtitles/bodies UNCHANGED):

```tsx
// step 0 — Welcome to Portage
screenshot: "/tutorials/adding-items/scan-home.png",
overlays: [{ type: "callout", x: 50, y: 40, text: "Your selling HQ", delay: 400 }],
// step 1 — Scan & Inventory
screenshot: "/tutorials/adding-items/scan-home.png",
overlays: [{ type: "tap", x: 50, y: 93 }],
// step 2 — List Anywhere
screenshot: "/tutorials/listings/create-listing.png",
overlays: [{ type: "highlight", x: 8, y: 25, w: 84, h: 30 }],
// step 3 — Track & Ship
screenshot: "/tutorials/orders/orders-tab.png",
overlays: [{ type: "highlight", x: 6, y: 20, w: 88, h: 30 }],
// step 4 — You're all set
screenshot: "/tutorials/inventory/browse.png",
overlays: [{ type: "callout", x: 50, y: 30, text: "Let's go", delay: 300 }],
```

5. Replace the icon block (the `w-24 h-24 …` div wrapping `{step.icon}`) with:

```tsx
            <div className="mb-6 mt-2">
              <DeviceFrame
                screenshot={step.screenshot}
                overlays={step.overlays}
                animationKey={step.id}
                alt={step.title}
                compact
              />
            </div>
```

- [ ] **Step 4: Run — verify green**

Run: `npm run test -w apps/web -- src/components/onboarding/onboarding-flow.test.tsx`
Expected: PASS (including the pre-existing scroll-constraint test).

- [ ] **Step 5: Write failing test — Explore tutorials button on last step**

```typescript
  it("shows a secondary Explore tutorials button only on the last step", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onExplore = vi.fn();
    render(
      <OnboardingFlow
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        isCompleting={false}
        onExploreTutorials={onExplore}
      />,
    );
    expect(screen.queryByRole("button", { name: "Explore tutorials" })).not.toBeInTheDocument();
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Explore tutorials" }));
    expect(onExplore).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 6: Run red, then implement**

Red run expected: FAIL — button never appears.

In the navigation-buttons block, add above the primary button (renders only on last step when handler provided):

```tsx
            {isLastStep && onExploreTutorials && (
              <button
                onClick={onExploreTutorials}
                className="flex-1 py-3 rounded-2xl border border-border text-text-secondary font-semibold text-sm hover:bg-muted transition-colors"
                disabled={isCompleting}
              >
                Explore tutorials
              </button>
            )}
```

(On the last step "Back" + "Explore tutorials" + "Start Scanning" would be three buttons — acceptable at `flex-1` in a 384px card, but drop the Back button on the last step if it visually crowds: `{currentStep > 0 && !isLastStep && (...)}`. Decide by looking at it in Task 11's walk; default = keep all three.)

- [ ] **Step 7: Run — verify green, then wire home page**

Run: `npm run test -w apps/web -- src/components/onboarding/onboarding-flow.test.tsx`
Expected: PASS.

In `apps/web/src/app/(tabs)/home/page.tsx` (~line 455), extend the mount:

```tsx
        <OnboardingFlow
          onComplete={completeOnboarding}
          onSkip={completeOnboarding}
          isCompleting={isCompleting}
          onExploreTutorials={() => {
            void completeOnboarding().then(() => router.push("/tutorials"));
          }}
        />
```

(Verified: home/page.tsx does NOT currently import `useRouter` — add `import { useRouter } from "next/navigation";` to the imports and `const router = useRouter();` inside the component.)

- [ ] **Step 8: Full web gates + commit**

Run: `npm run typecheck && npm run lint && npm run test -w apps/web`
Expected: clean, all green.

```bash
git add apps/web/src/components/onboarding/onboarding-flow.tsx apps/web/src/components/onboarding/onboarding-flow.test.tsx "apps/web/src/app/(tabs)/home/page.tsx"
git commit -m "feat(web): onboarding carousel — device-framed screenshots + Explore tutorials"
```

---

### Task 10: Capture pipeline

**Files:**
- Create: `apps/web/scripts/capture-tutorials.ts`
- Modify: `apps/web/package.json` (script + `tsx` devDep)
- Modify: `package.json` (root alias)
- Modify: `apps/web/CLAUDE.md` (gotcha entry)

**Interfaces:**
- Consumes: `CAPTURE_MANIFESTS` via relative import (`@/` alias unavailable under tsx).
- Produces: `npm run capture:tutorials` → writes `apps/web/public/tutorials/<topic>/<step>.png` for every capture point. NOT in CI.

Script auth mirrors the proven e2e pattern (`e2e/auth.setup.ts` + `e2e/session-stub.ts`): `GET /auth/session` against the API (dev bypass `CF_ACCESS_DEV_EMAIL` on LAN, or `E2E_CF_CLIENT_ID/SECRET` service token), inject `portage_token`/`portage_user` into localStorage, stub the edge `**/backend/auth/session` route so the app's mount-time exchange doesn't wipe the token.

- [ ] **Step 1: Add deps + scripts**

```bash
npm install -D tsx -w apps/web
```

`apps/web/package.json` scripts — add:

```json
    "capture:tutorials": "tsx scripts/capture-tutorials.ts"
```

Root `package.json` scripts — add:

```json
    "capture:tutorials": "npm run capture:tutorials -w apps/web"
```

- [ ] **Step 2: Write the script**

`apps/web/scripts/capture-tutorials.ts`:

```typescript
/**
 * Tutorial screenshot capture pipeline.
 *
 * Regenerates apps/web/public/tutorials/<topic>/<step>.png from the capture
 * manifests exported by src/lib/tutorials. Run against a LIVE app whenever the
 * UI changes, then commit the PNGs:
 *
 *   npm run capture:tutorials            # app on :3002, API on :8016
 *   CAPTURE_BASE_URL=... CAPTURE_API_URL=... npm run capture:tutorials
 *
 * Auth mirrors e2e/auth.setup.ts: GET /auth/session (CF_ACCESS_DEV_EMAIL dev
 * bypass on LAN, or CF Access service token via E2E_CF_CLIENT_ID/SECRET),
 * localStorage injection, plus the session-stub route so the app's mount-time
 * edge exchange can't wipe the injected token. NOT run in CI.
 */
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { installSessionStub } from "../e2e/session-stub";
import { CAPTURE_MANIFESTS } from "../src/lib/tutorials/index";
import type { CaptureAction } from "../src/lib/tutorials/types";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://10.0.0.251:3002";
const API_URL = process.env.CAPTURE_API_URL ?? "https://10.0.0.251:8016";
const OUT_ROOT = path.resolve(__dirname, "../public/tutorials");
const VIEWPORT = { width: 390, height: 844 };

async function getSession(): Promise<{ token: string; user: unknown }> {
  const headers: Record<string, string> = {};
  if (process.env.E2E_CF_CLIENT_ID && process.env.E2E_CF_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.E2E_CF_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.E2E_CF_CLIENT_SECRET;
  }
  const res = await fetch(`${API_URL}/auth/session`, { headers });
  if (!res.ok) throw new Error(`session exchange failed: ${res.status}`);
  return (await res.json()) as { token: string; user: unknown };
}

async function runAction(page: Page, topic: string, action: CaptureAction): Promise<void> {
  switch (action.type) {
    case "goto":
      await page.goto(`${BASE_URL}${action.path}`, { waitUntil: "networkidle" });
      return;
    case "click": {
      const el = page.locator(action.selector).first();
      if ((await el.count()) === 0) {
        console.warn(`[${topic}] click target missing, skipping: ${action.selector}`);
        return;
      }
      await el.click();
      return;
    }
    case "fill": {
      const el = page.locator(action.selector).first();
      if ((await el.count()) === 0) {
        console.warn(`[${topic}] fill target missing, skipping: ${action.selector}`);
        return;
      }
      await el.fill(action.value);
      return;
    }
    case "wait":
      await page.waitForTimeout(action.ms);
      return;
    case "capture": {
      const dir = path.join(OUT_ROOT, topic);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${action.step}.png`);
      await page.screenshot({ path: file });
      console.log(`captured ${path.relative(process.cwd(), file)}`);
      return;
    }
  }
}

async function main(): Promise<void> {
  const session = await getSession();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [
            { name: "portage_token", value: session.token },
            { name: "portage_user", value: JSON.stringify(session.user) },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  // Reuse the proven e2e session stub (one copy to keep in sync): answers the
  // app's mount-time edge exchange with the session seeded in storage state;
  // every data call below it stays real.
  await installSessionStub(page);

  let failures = 0;
  for (const manifest of CAPTURE_MANIFESTS) {
    console.log(`\n=== topic: ${manifest.topic} ===`);
    for (const action of manifest.actions) {
      try {
        await runAction(page, manifest.topic, action);
      } catch (err) {
        failures++;
        console.error(`[${manifest.topic}] action failed:`, action, err);
      }
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n${failures} action(s) failed`);
    process.exit(1);
  }
  console.log("\nAll captures complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. (Verified: `apps/web/tsconfig.json` includes a bare `**/*.ts` glob, so `scripts/capture-tutorials.ts` IS type-checked — same as the 26 `e2e/**` files. `__dirname` is fine: ambient `@types/node` global, and tsx polyfills it at runtime. Vitest ignores the script — include pattern is `src/**` only.)

- [ ] **Step 4: Document in `apps/web/CLAUDE.md` Gotchas**

Append:

```markdown
- **Tutorial screenshots rot:** `/tutorials` pages render PNGs from `public/tutorials/**` captured by `npm run capture:tutorials` (needs the app running; not in CI). After any visible UI change to home, inventory, listings, orders, settings, porter, or messages screens, re-run the capture and commit the updated PNGs — overlay coords live in `src/lib/tutorials/*` next to each topic's capture manifest.
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/capture-tutorials.ts apps/web/package.json package.json package-lock.json apps/web/CLAUDE.md
git commit -m "feat(web): scripted Playwright tutorial screenshot capture pipeline"
```

---

### Task 11: Capture run, coord verification, full gates, deploy, DoD proof

**Files:**
- Create: `apps/web/public/tutorials/**/*.png` (24 screenshots: 8 topics × 3 steps)
- Modify: `apps/web/src/lib/tutorials/*.ts` (overlay coord corrections only)

This is the **Definition of Done** task — run the app, observe behavior, screenshot proof. Use the frontend-verification skill at execution time.

- [ ] **Step 1: Run capture against the live app**

The live container on :3002 already serves every screen the manifests visit (they capture existing pages, not the new tutorial routes), so capture works BEFORE deploying this branch.

Run: `npm run capture:tutorials`
Expected: `captured apps/web/public/tutorials/...` × 24, exit 0. If auth fails on the LAN prod-mode API, set the service-token envs (`E2E_CF_CLIENT_ID/SECRET`) the e2e suite uses.

**Account note:** run with the demo account (`CF_ACCESS_DEV_EMAIL=<demo email from Doppler>` against a dev API, or the demo-account service token) — screenshots of Stephen's real inventory/orders/messages would leak personal data into committed assets. Inspect every PNG for personal info before committing.

- [ ] **Step 2: Verify overlay coords against the real PNGs**

Open each captured PNG, compare against the topic module's overlay coords, and correct `x/y/w/h` in `src/lib/tutorials/*.ts` so highlights ring the actual UI elements. Rerun the content tests after edits:

Run: `npm run test -w apps/web -- src/lib/tutorials/content.test.ts`
Expected: PASS.

- [ ] **Step 3: Full quality gates**

Run: `npm run typecheck && npm run lint && npm run test -w apps/web && npm run test:api`
Expected: all green (api suite untouched — confirms no cross-workspace breakage).

- [ ] **Step 4: Deploy + walk the app (DoD)**

```bash
docker compose up -d --build portage-app
```

Then at mobile viewport (390×844) on `http://10.0.0.251:3002` — AND repeat check 4 at **375×667 (iPhone SE class)**: the carousel's "Start Scanning" CTA must be visible without scrolling (adversarial-review height-budget check):
1. `/tutorials` — 8 cards render; each topic opens and plays all steps; overlays land on the right UI elements; Back returns to hub.
2. More tab → Tutorials link navigates; Help page → Tutorials card navigates.
3. Replay intro shows the carousel; Skip closes it without touching the onboarding flag.
4. Fresh user (demo account with `onboardingCompleted=false`, reset via DB or admin): carousel shows device-framed screenshots + animations; final step "Explore tutorials" completes onboarding AND lands in the hub.
5. Capture proof screenshots of: hub, one playing topic with visible overlay, upgraded carousel step, carousel final step with both buttons.

- [ ] **Step 5: Commit assets + corrections, push, PR**

```bash
git add apps/web/public/tutorials apps/web/src/lib/tutorials
git commit -m "feat(web): captured tutorial screenshots + verified overlay coords"
git push -u origin feat/onboarding-tutorials
gh pr create --title "feat: onboarding expansion — tutorial hub + screenshot show-and-tell" --body "<summary + DoD proof screenshots>"
```

Expected: CI green (e2e/build/lint), CodeRabbit review, merge with `--merge`.

---

## Self-Review (performed at write time)

- **Spec coverage:** content model (T1–T3), TutorialPlayer + overlays + reduced-motion + placeholder (T4–T5), hub + topic routes + notFound (T6–T7), entry points ×4 incl. replay-intro (T6, T8, T9), carousel upgrade + Explore tutorials (T9), capture pipeline + npm script + docs (T10), error handling (T4 placeholder, T7 notFound, T10 skip-on-missing-selector), testing section (schema tests T1, player tests T5, hub render + unknown-topic 404 T6–T7, onboarding tests T9, capture excluded from CI T10), verification/DoD (T11). Gap check: none found.
- **Placeholder scan:** all code steps carry full code; overlay coords flagged as estimates with a dedicated verification step (T11.2) — intentional, not a placeholder.
- **Type consistency:** `Overlay`/`TutorialStep`/`TutorialTopic`/`CaptureAction`/`CaptureManifest` defined once (T1) and consumed by name everywhere; `DeviceFrame` props (`screenshot`, `overlays`, `animationKey`, `alt`, `compact`) consistent across T4/T5/T9; `TutorialPlayer({ topic })` consistent across T5/T7; `onExploreTutorials` consistent across T9 component/mount/test.
