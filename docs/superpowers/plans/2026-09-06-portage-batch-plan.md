# Portage batch (Porter, inventory UI, header, listing content, eBay sync gaps) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Porter find inventory and know the app, paginate the inventory, put the user menu and theme toggle on every header, fix light-mode tags and the iOS caret bug, let sellers pick several values on multi-value item specifics, apply the operator-approved listing wording, and close the five approved eBay sync gaps — built by parallel lanes on disjoint files, each lane TDD, each lane live-proven.

**Architecture:** Seven independent lanes, each on its own branch from `main` in its own worktree and touching a disjoint file set (listed per lane; a file appears in exactly one lane). Phase 0 collects the operator decisions the lanes need. Phase 1 runs the lanes in parallel. Phase 2 merges in a fixed order, runs the full suites, brings up the isolated e2e stack for screenshots, deploys API and web, then flips the Doppler chain. Phase 3 is the operator's device verification.

**Tech Stack:** Express 5 + Drizzle (apps/api), Next.js 16 + React 19 + Tailwind v4 (apps/web), vitest 4 under tdd-guard, Playwright for proof, Docker Compose, Doppler.

**Spec:** `docs/superpowers/specs/2026-09-06-portage-batch-spec.md`

## Global Constraints

- One `it(...)` per Write/Edit that adds tests; red, then minimal green, then next (`.claude/rules/tdd-one-test-per-write.md`).
- Use the Edit tool for source edits (Bash edits bypass tdd-guard).
- Worktree lanes run vitest with the local guard config: `cd apps/api && npx vitest run --config vitest.guard.config.ts …` (and `apps/web` likewise). Both files exist untracked in `.claude/worktrees/feat+scan-provenance/apps/{api,web}/vitest.guard.config.ts`; copy them into each lane worktree before the first test run (content in Task 0.4). Never commit them.
- Concurrent test runs from two lanes overwrite `/home/swebber64/DHG/portage/.claude/tdd-guard/data/test.json`. Phase 0 decides serialization (Task 0.4).
- No `git commit` / `git push` / `gh pr merge` without the operator's per-action approval; `gh pr create` is exempt.
- Any `.tsx` change needs a proof screenshot under `apps/web/test-results/proof/<lane>/` newer than the change, verified by eye, sent with SendUserFile, before push.
- Never write "I am selling", "This listing includes", "Up for sale", "You are looking at" in any prompt-generated text; first-person seller voice states the item directly.
- Description cap is 4000 chars (`items.description`), condition notes 2000.
- eBay title cap 80 chars; item specifics use eBay's cardinality (`SINGLE` one value, `MULTI` many).
- Live deploy command shape: `GIT_SHA=<sha> docker compose -p portage --project-directory /home/swebber64/DHG/portage -f /home/swebber64/DHG/portage/docker-compose.yml -f <override with build contexts> up -d --build <service>`; the API runs on the Doppler `dev` config synced to `/home/swebber64/DHG/portage/.env`.

---

## Phase 0 — Decisions and lane setup (operator + orchestrator, sequential, ~30 min)

### Task 0.1: Operator decisions

**Files:** none (answers recorded in `docs/superpowers/specs/2026-09-06-portage-batch-spec.md` under a new "Decisions" heading by the orchestrator).

- [ ] **Step 1: Template wording.** Operator answers the five questions in `docs/research/2026-09-06-ebay-description-best-practices.md` §7 (labelled sections vs paragraphs; bullets vs prose for specs; length band; seed with own past descriptions; Function separate or inside Condition). Lane G Task G.2 encodes the answers.
- [ ] **Step 2: Sync gaps.** Operator confirms gaps 1, 2, 3, 5, 6 (spec §H). Any "no" removes the matching task from Lane F.
- [ ] **Step 3: Porter.** Operator confirms the chain `gemini:gemini-3.8-flash,gemini:gemini-2.5-flash` and reviews the "About Portage" block text in Task A.3 before it ships.
- [ ] **Step 4: pg_trgm.** Operator says yes/no to `CREATE EXTENSION pg_trgm` on portage-db (typo tolerance for Porter search). "No" keeps word matching only.
- [ ] **Step 5: Epson re-sync.** Operator says go/no for one ReviseFixedPriceItem on item `ecc3586c-dea1-4736-be7c-c087ef54dbf6` (Task G.3).
- [ ] **Step 6: tdd-guard for parallel lanes.** Pick one: (a) serialize test runs with a file lock (Task 0.4 provides the wrapper); (b) operator launches one Claude session per lane rooted in its worktree; (c) operator approves a scoped tdd-guard bypass via the `tdd-guard-bypass` skill for the autonomous run. Default if unanswered: (a).

### Task 0.2: Cut lane worktrees

**Files:** none in the repo.

- [ ] **Step 1: Fetch main**

```bash
cd /home/swebber64/DHG/portage/.claude/worktrees/feat+scan-provenance && git fetch origin main
```

- [ ] **Step 2: Create one worktree per lane (A–G) from `origin/main`**

```bash
for lane in a-porter b-pagination c-header d-textarea-tags e-aspects f-sync-gaps g-listing-content; do
  git worktree add "/home/swebber64/DHG/portage/.claude/worktrees/lane-$lane" -b "feat/lane-$lane" origin/main
done
```

- [ ] **Step 3: Install deps and build shared in each lane**

```bash
for lane in a-porter b-pagination c-header d-textarea-tags e-aspects f-sync-gaps g-listing-content; do
  (cd "/home/swebber64/DHG/portage/.claude/worktrees/lane-$lane" && npm ci --no-audit --no-fund && npm run build -w packages/shared)
done
```

### Task 0.3: Decide the fate of the UNAPPROVED uncommitted edits in `feat+scan-provenance`

These were written on 2026-09-06 without a go and are not approved. They sit
uncommitted in `.claude/worktrees/feat+scan-provenance`: `apps/api/src/lib/porter-grounding.ts`
(+test), `apps/api/src/lib/porter-search.ts` (+test, new), `apps/api/src/routes/porter.ts`
(word search wired, tool description), `apps/api/src/lib/vision.ts` (+test; the
"I am selling" ban). Operator chooses per file: **adopt** (copy into the lane as
that lane's starting point, then TDD continues from there) or **revert**
(`git checkout -- <file>` / delete the new files). Nothing is carried without
that choice.

Original task text follows for the adopt case.

#### Task 0.3a: Carry the adopted changes into their lanes

**Files:**
- Lane A: `apps/api/src/lib/porter-grounding.ts`, `apps/api/src/lib/porter-grounding.test.ts`, `apps/api/src/lib/porter-search.ts`, `apps/api/src/lib/porter-search.test.ts`, `apps/api/src/routes/porter.ts`
- Lane G: `apps/api/src/lib/vision.ts`, `apps/api/src/lib/vision.test.ts` (the "I am selling" ban only)

- [ ] **Step 1: Copy Lane A files from `feat+scan-provenance` into `lane-a-porter`** (these are the grounding fix, word search, and tool description already green in this session: grounding 11/11, search 1/1, porter-tools 6/6).

```bash
W=/home/swebber64/DHG/portage/.claude/worktrees
for f in apps/api/src/lib/porter-grounding.ts apps/api/src/lib/porter-grounding.test.ts apps/api/src/lib/porter-search.ts apps/api/src/lib/porter-search.test.ts apps/api/src/routes/porter.ts; do
  cp "$W/feat+scan-provenance/$f" "$W/lane-a-porter/$f"
done
```

- [ ] **Step 2: Copy the ban into Lane G** — only the prompt lines: in `apps/api/src/lib/vision.ts` the `Never: announcing openers — "I am selling", …` paragraph inside `DETAILED_SYSTEM_PROMPT`, the `Never open with "I am selling" or any announcing phrase.` sentence in the conditionNotes rule, the `Never: announcing openers (…)` clause in `LISTING_FIELDS_SYSTEM_PROMPT`, and the test `bans the "I am selling" opener…` in `vision.test.ts`. Apply with the Edit tool in `lane-g-listing-content` (same text as in `feat+scan-provenance`).

- [ ] **Step 3: Verify both lanes green**

```bash
cd $W/lane-a-porter/apps/api && npx vitest run --config vitest.guard.config.ts src/lib/porter-grounding.test.ts src/lib/porter-search.test.ts src/routes/__tests__/porter-tools.test.ts
cd $W/lane-g-listing-content/apps/api && npx vitest run --config vitest.guard.config.ts src/lib/vision.test.ts
```
Expected: all pass.

### Task 0.4: Guard configs and the test lock (decision 0.1 step 6 = (a))

**Files:**
- Create in every lane: `apps/api/vitest.guard.config.ts`, `apps/web/vitest.guard.config.ts` (untracked; add to `.git/info/exclude` of the shared repo so no lane can commit them)
- Create: `/home/swebber64/DHG/portage/.claude/scripts/vitest-locked.sh`

- [ ] **Step 1: Guard config content (api)**

```ts
// LOCAL ONLY — never commit. tdd-guard's validator reads test.json under the
// main checkout; this points the reporter there.
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';
export default mergeConfig(base, defineConfig({
  test: { reporters: ['default', ['tdd-guard-vitest', { projectRoot: '/home/swebber64/DHG/portage' }]] },
}));
```

Web is identical with double quotes and `./vitest.config`.

- [ ] **Step 2: Exclude them**

```bash
printf 'apps/api/vitest.guard.config.ts\napps/web/vitest.guard.config.ts\n' >> /home/swebber64/DHG/portage/.git/info/exclude
```

- [ ] **Step 3: Lock wrapper** — every lane runs tests through it so two lanes never write `test.json` at once:

```bash
#!/usr/bin/env bash
# vitest-locked.sh <workspace-dir> <vitest args…>
set -euo pipefail
dir="$1"; shift
exec 9>/home/swebber64/DHG/portage/.claude/tdd-guard/data/.vitest.lock
flock -w 600 9
cd "$dir" && npx vitest run --config vitest.guard.config.ts "$@"
```

`chmod +x` it. Lanes call `~/DHG/portage/.claude/scripts/vitest-locked.sh <lane>/apps/api src/lib/foo.test.ts -t "name"`.

Rule for lanes: run the test, then immediately make the Edit the guard must validate, before any other lane's run can replace `test.json`. If the guard rejects a compliant edit, re-run the same test and retry the same edit once.

---

## Phase 1 — Parallel lanes

Each lane: TDD per task, commit per task (operator approval per commit is required — lanes queue their commit messages and the orchestrator asks once per lane), `gh pr create` at the end, proof screenshots for any `.tsx` change.

### Lane A — Porter (API only)

**Owned files:** `apps/api/src/routes/porter.ts`, `apps/api/src/lib/porter-grounding.ts` (+test), `apps/api/src/lib/porter-search.ts` (+test), `apps/api/src/routes/__tests__/porter-action-pills.test.ts`, `apps/api/src/routes/__tests__/porter-tools.test.ts`.

#### Task A.1: Grounding accepts a whole entry line (done — verify only)

- [ ] **Step 1: Run**

```bash
~/DHG/portage/.claude/scripts/vitest-locked.sh $W/lane-a-porter/apps/api src/lib/porter-grounding.test.ts
```
Expected: 11 passed, including `does not flag a real title whose first comma segment is a bare word like "NEW"`.

#### Task A.2: Word-level inventory search (done — verify only)

- [ ] **Step 1: Run**

```bash
~/DHG/portage/.claude/scripts/vitest-locked.sh $W/lane-a-porter/apps/api src/lib/porter-search.test.ts src/routes/__tests__/porter-tools.test.ts
```
Expected: 1 + 5 passed. `porter.ts` search block reads:

```ts
if (query) {
  const wordMatch = inventorySearchConditions(query);
  if (wordMatch) conditions.push(wordMatch);
}
```

#### Task A.3: "About Portage" facts in the system prompt

**Files:**
- Modify: `apps/api/src/routes/porter.ts` (`PORTER_SYSTEM`, after the "Always be direct and actionable" line)
- Test: `apps/api/src/routes/__tests__/porter-action-pills.test.ts`

- [ ] **Step 1: Write the failing test** (append inside the existing `describe` that already asserts on `PORTER_SYSTEM`)

```ts
it('system prompt carries the About Portage facts so app questions get answers instead of "I don\'t know" (operator 2026-09-06)', () => {
  expect(PORTER_SYSTEM).toContain('## About Portage');
  expect(PORTER_SYSTEM).toContain('Scan button');
  expect(PORTER_SYSTEM).toContain('sync log');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
~/DHG/portage/.claude/scripts/vitest-locked.sh $W/lane-a-porter/apps/api src/routes/__tests__/porter-action-pills.test.ts -t "About Portage"
```
Expected: FAIL, `expected … to contain '## About Portage'`.

- [ ] **Step 3: Add the block to `PORTER_SYSTEM`** (Edit tool; insert after `Always be direct and actionable. If you don't know something, say so.`)

```text

## About Portage (facts you may state; if a question is not covered here, say you don't know)
- Portage is a personal inventory and multi-marketplace seller app. Bottom bar: Home, Inventory, Porter (you), Orders, with the center Scan button. Listings are reached from Home or Inventory. Settings, seller profile, marketplace connections, billing, and the sync log are under the avatar menu (More).
- Scan: the seller photographs an item; the AI identifies it (name, brand, model, condition, description, eBay item specifics, packaged weight and box size); the Review screen lets them edit everything; Save stores it in Inventory; Save & List also creates the eBay listing (draft or live per their setting).
- Marketplaces: eBay (live) and Reverb (music gear). Publish from the item page. Editing an item in Portage (title, description, price, quantity, condition, condition notes, photos, item specifics) syncs to its live listings automatically; the badge on the item's listing card shows Syncing / Synced / Sync failed with Retry; Settings → Sync log has the history.
- Orders: the Orders tab lists eBay and Reverb sales; shipping labels are created on eBay.
- Item edit page: title, description, condition, price, status, category (eBay category lookup), condition notes, brand, model, weight and dimensions, item specifics, photos.
- Porter tools: search the seller's inventory by words in title, brand, model, or description; inventory totals and category counts; a listing suggestion for one item.
```

- [ ] **Step 4: Run to verify it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Operator wording check** — post the block text in the lane report; the orchestrator gets the operator's yes before the lane's PR is merged (Task 0.1 step 3).

- [ ] **Step 6: Commit (after approval)**

```bash
git add apps/api/src/routes/porter.ts apps/api/src/routes/__tests__/porter-action-pills.test.ts
git commit -m "feat(porter): About Portage facts in the system prompt"
```

#### Task A.4: Optional typo tolerance (only if Task 0.1 step 4 = yes)

**Files:**
- Modify: `apps/api/src/lib/porter-search.ts`, `apps/api/src/routes/porter.ts` (search case)
- Test: `apps/api/src/lib/porter-search.test.ts`

- [ ] **Step 1: DB change (operator runs or approves)**

```bash
docker exec portage-db psql -U portage -d portage -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

- [ ] **Step 2: Write the failing test**

```ts
it('builds a trigram-similarity fallback ordered by similarity when word matching is allowed to miss', () => {
  const sql = fuzzyTitleCondition('sennal 148');
  expect(String(sql?.queryChunks?.length ?? 0)).not.toBe('0');
});
```

- [ ] **Step 3: Run** — Expected: FAIL, `fuzzyTitleCondition is not a function`.

- [ ] **Step 4: Implement** in `porter-search.ts`:

```ts
import { sql, type SQL } from 'drizzle-orm';
export function fuzzyTitleCondition(query: string): SQL | null {
  const q = query.trim();
  if (!q) return null;
  return sql`similarity(${items.title}, ${q}) > 0.3`;
}
```

and in `porter.ts` `runSearch`: when the word-match result is empty and a query exists, run a second select with `fuzzyTitleCondition(query)` and `.orderBy(sql\`similarity(${items.title}, ${query}) desc\`)`, limit 10, merge unique by id.

- [ ] **Step 5: Run the search tests** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/porter-search.ts apps/api/src/lib/porter-search.test.ts apps/api/src/routes/porter.ts
git commit -m "feat(porter): trigram fallback for typo'd inventory searches"
```

#### Task A.5: Lane A gates and PR

- [ ] **Step 1:** `~/DHG/portage/.claude/scripts/vitest-locked.sh $W/lane-a-porter/apps/api` — Expected: all files pass (baseline 1094 + new).
- [ ] **Step 2:** `cd $W/lane-a-porter && npm run typecheck -w apps/api` — Expected: no `error TS`.
- [ ] **Step 3:** Review record via `.claude/hooks/record-review.sh` with `CLAUDE_PROJECT_DIR=$W/lane-a-porter` after a reviewer pass (caveman:cavecrew-reviewer on `git diff --cached`).
- [ ] **Step 4:** Push + `gh pr create --base main --head feat/lane-a-porter` (push needs approval; no `.tsx` in this lane so no proof gate).

### Lane B — Inventory pagination (web)

**Owned files:** `apps/web/src/components/inventory/pager.tsx` (new), `apps/web/src/components/inventory/pager.test.tsx` (new), `apps/web/src/app/(tabs)/inventory/page.tsx`, `apps/web/src/app/(tabs)/inventory/workbench.test.tsx`.

**Interfaces:**
- Produces: `Pager({ page, pageSize, total, onPageChange, onPageSizeChange })` with `page` 1-based, `pageSize ∈ {25,50,100}`.
- Consumes: `useItems({ …, limit: pageSize, offset: (page-1)*pageSize })` returning `{ items, total }` (existing).

#### Task B.1: Pager component

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/inventory/pager.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pager } from "./pager";

describe("Pager", () => {
  it("shows the range, moves pages, and changes the page size through a 25/50/100 select", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(<Pager page={2} pageSize={50} total={201} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);

    expect(screen.getByText("51–100 of 201")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "100" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
```

- [ ] **Step 2: Run** — `~/DHG/portage/.claude/scripts/vitest-locked.sh $W/lane-b-pagination/apps/web src/components/inventory/pager.test.tsx` — Expected: FAIL, cannot find module `./pager`.

- [ ] **Step 3: Implement** — `apps/web/src/components/inventory/pager.tsx`

```tsx
"use client";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

interface PagerProps {
  page: number;            // 1-based
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

/** Inventory pager: range text, previous/next, and a 25/50/100 page-size select. */
export function Pager({ page, pageSize, total, onPageChange, onPageSizeChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm text-text-secondary">
      <span>{first}–{last} of {total}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="sr-only">Items per page</span>
          <select
            aria-label="Items per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="rounded-lg bg-muted px-2 py-1 text-text-primary"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </label>
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-lg bg-muted px-3 py-1 disabled:opacity-40">‹</button>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="rounded-lg bg-muted px-3 py-1 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/pager.tsx apps/web/src/components/inventory/pager.test.tsx
git commit -m "feat(inventory): Pager component (25/50/100 per page)"
```

#### Task B.2: Wire the pager into the inventory page (mobile list and workbench pane)

**Files:**
- Modify: `apps/web/src/app/(tabs)/inventory/page.tsx` (state near line 199 `const [view, setView]`; `useItems` call line 210; mobile list after `<ItemsGrid …/>` inside the `lg:hidden` block; workbench list pane after the `{total} item…` count line)
- Test: `apps/web/src/app/(tabs)/inventory/workbench.test.tsx`

- [ ] **Step 1: Write the failing test** (append to the existing describe; `useItemsMock` already exists in the file)

```tsx
it("passes limit/offset from the pager to useItems and resets to page 1 when the page size changes", () => {
  useItemsMock.mockReturnValue({ items: [], total: 201, isLoading: false, error: null, refetch: vi.fn() });
  render(<InventoryPage />);
  const select = screen.getAllByLabelText("Items per page")[0];
  fireEvent.change(select, { target: { value: "100" } });
  const lastCall = useItemsMock.mock.calls.at(-1)?.[0] as { limit?: number; offset?: number };
  expect(lastCall.limit).toBe(100);
  expect(lastCall.offset).toBe(0);
});
```

If `useItems` is mocked as `useItems: () => useItemsMock()` (ignores args), change the mock to `useItems: (opts) => useItemsMock(opts)` in the same file so the call args are captured.

- [ ] **Step 2: Run** — Expected: FAIL, no element with label "Items per page".

- [ ] **Step 3: Implement** in `page.tsx`

```tsx
import { Pager, type PageSize } from "@/components/inventory/pager";
// state, next to `view`
const [pageSize, setPageSize] = useState<PageSize>(50);
const [page, setPage] = useState(1);
// filters change → back to page 1
useEffect(() => { setPage(1); }, [search, category, status]);
const { items, total, isLoading, error, refetch } = useItems({ search, category, status, limit: pageSize, offset: (page - 1) * pageSize });
const pager = (
  <Pager page={page} pageSize={pageSize} total={total} onPageChange={setPage}
    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
);
```

Render `{!isLoading && !error && total > 0 && pager}` directly after `<ItemsGrid …/>` in the mobile block and directly after the `{total} item…` count row in the workbench list pane.

- [ ] **Step 4: Run the page tests** — `… apps/web "src/app/(tabs)/inventory/workbench.test.tsx" src/components/inventory/pager.test.tsx` — Expected: PASS.

- [ ] **Step 5: Proof** — e2e stack (Task 2.3 harness) with the seeded 201-item fixture: screenshot inventory at 25/page page 2 and 100/page page 3, light theme, under `apps/web/test-results/proof/pagination/`.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(tabs)/inventory/page.tsx" "apps/web/src/app/(tabs)/inventory/workbench.test.tsx"
git commit -m "feat(inventory): paginate the list with a 25/50/100 selector"
```

### Lane C — Header cluster everywhere + edit-page sync outcome (web)

**Owned files:** `apps/web/src/components/layout/header-actions.tsx` (new, +test), `apps/web/src/components/layout/page-header.tsx` (+test), and the custom headers: `apps/web/src/components/inventory/item-detail.tsx`, `apps/web/src/app/inventory/[id]/edit/page.tsx` (+ `edit-page.test.tsx`), `apps/web/src/components/capture/scan-flow.tsx` (header block only, lines ~861–880), `apps/web/src/app/messages/[conversationKey]/page.tsx`, `apps/web/src/app/orders/[id]/page.tsx`, `apps/web/src/app/inventory/[id]/preview/page.tsx`, `apps/web/src/app/tutorials/page.tsx`, `apps/web/src/app/tutorials/[topic]/page.tsx`, `apps/web/src/app/settings/{profile,help,notifications,marketplace}/page.tsx`, `apps/web/src/app/(tabs)/porter/page.tsx`.

**Interfaces:** Produces `<HeaderActions />` (no props) rendering `ThemeToggle` + the avatar link to `/more` with the unread dot.

#### Task C.1: HeaderActions component

- [ ] **Step 1: Failing test** — `apps/web/src/components/layout/header-actions.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderActions } from "./header-actions";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { email: "s@x.com" } }) }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 2 }) }));

describe("HeaderActions", () => {
  it("renders the theme toggle and the avatar link to /more with the unread dot", () => {
    render(<HeaderActions />);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings, 2 unread messages" })).toHaveAttribute("href", "/more");
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** — `apps/web/src/components/layout/header-actions.tsx` (move the avatar markup out of `page-header.tsx` verbatim):

```tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";
import { ThemeToggle } from "@/components/theme-toggle";

/** The always-present header cluster: theme toggle + user menu (avatar → /more). */
export function HeaderActions() {
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-primary" />
      {user && (
        <Link
          href="/more"
          aria-label={unreadCount > 0 ? `Settings, ${unreadCount} unread messages` : "Settings"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--teal)] font-bold text-white"
        >
          {user.email.charAt(0).toUpperCase()}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--background)] bg-[var(--orange)]" />
          )}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `git add apps/web/src/components/layout/header-actions.tsx apps/web/src/components/layout/header-actions.test.tsx && git commit -m "feat(layout): HeaderActions cluster (theme toggle + user menu)"`

#### Task C.2: PageHeader always renders the cluster

- [ ] **Step 1: Failing test** (append to `page-header.test.tsx`)

```tsx
it("always renders the theme toggle and avatar, even without showAvatar", () => {
  render(<PageHeader title="Orders" />);
  expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** — Expected: FAIL (no toggle).
- [ ] **Step 3: Implement** — in `page-header.tsx` replace the `avatar` computation and `{avatar}` with `<HeaderActions />`; keep the `showAvatar` prop accepted (unused, so call sites compile) and remove the `useAuth`/`useUnreadCount` imports.
- [ ] **Step 4: Run `page-header.test.tsx`** — Expected: PASS (existing showAvatar test still passes because the link is always there).
- [ ] **Step 5: Commit** — `git add apps/web/src/components/layout/page-header.tsx apps/web/src/components/layout/page-header.test.tsx && git commit -m "feat(layout): PageHeader always shows the header cluster"`

#### Task C.3: Custom headers get the cluster

- [ ] **Step 1: Failing test** (in `apps/web/src/app/inventory/[id]/edit/edit-page.test.tsx`, existing render helper)

```tsx
it("edit page header carries the theme toggle and user menu", () => {
  renderEditPage();
  expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** — in every owned custom header, add `<HeaderActions />` as the last child of the header's flex row (for rows that are `flex items-center` without `justify-between`, wrap the title in `flex-1` first so the cluster sits right). Files and anchors: item-detail.tsx headers at ~457 and ~520; edit page ~140 (loading skeleton) and ~222; scan-flow ~861 (keep the close/back button on the left, add the cluster on the right of the title); messages thread ~81; order detail ~171; preview ~72; tutorials ~67 and ~21; settings profile ~88, help ~33, notifications ~66, marketplace ~82; porter tab ~43 (its right side currently holds a "New chat" control: place the cluster after it).
- [ ] **Step 4: Run** — edit-page tests plus `item-detail.test.tsx`, `scan-flow.test.tsx` — Expected: PASS.
- [ ] **Step 5: Commit** — one commit, all owned headers: `git commit -m "feat(layout): user menu + theme toggle on every header"`

#### Task C.4: Edit page lands on the item (sync gap 2 — if approved)

- [ ] **Step 1: Failing test** (edit-page.test.tsx)

```tsx
it("after a save that queued a marketplace sync, goes to the item page (where the sync badge is) instead of back", async () => {
  apiMock.mockResolvedValueOnce({ id: "item-1", syncQueued: ["row-1"] });
  renderEditPage();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/inventory/item-1"));
});
```
(adapt `apiMock`/`routerMock` to the names already used in that test file.)

- [ ] **Step 2: Run** — Expected: FAIL (`router.back` called).
- [ ] **Step 3: Implement** — in the save handler (page.tsx ~186–197): after the `syncWarnings` branch,

```tsx
if (saved?.syncQueued?.length) { router.replace(`/inventory/${id}`); return; }
router.back();
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — `git commit -m "feat(edit): land on the item after a save that queued a sync"`

#### Task C.5: Lane C proof + PR

- [ ] Screenshots on the e2e stack: home/inventory (PageHeader), item detail, edit page, scan review, settings profile, Porter tab — light and dark — under `apps/web/test-results/proof/header/`. Verify by eye, SendUserFile. Then web suite, typecheck, lint, review record, push (approval), `gh pr create`.

### Lane D — Textarea caret + light-mode tags (web)

**Owned files:** `apps/web/src/components/ui/auto-grow-textarea.tsx` (+test), `apps/web/src/app/globals.css`, `apps/web/src/components/inventory/status-chip.tsx` (+test), `apps/web/src/components/inventory/item-detail.tsx` — **only** the `conditionColors` map (Lane C owns its headers; coordinate: Lane D edits lines 1–60 region only, Lane C edits ≥457).

#### Task D.1: Grow-only textarea (iOS caret)

- [ ] **Step 1: Failing test** (append to `auto-grow-textarea.test.tsx`)

```tsx
it("does not rewrite the height while focused when the content still fits (iOS caret desync, 2026-09-06)", () => {
  let scrollHeight = 120;
  const spy = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => scrollHeight);
  const { rerender } = render(<AutoGrowTextarea aria-label="Notes" value="one" onChange={() => {}} />);
  const el = screen.getByLabelText("Notes") as HTMLTextAreaElement;
  el.focus();
  const heightAfterMount = el.style.height;
  const writes: string[] = [];
  const orig = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "height");
  Object.defineProperty(el.style, "height", { set(v) { writes.push(String(v)); }, get() { return heightAfterMount; }, configurable: true });
  rerender(<AutoGrowTextarea aria-label="Notes" value="one two" onChange={() => {}} />);
  expect(writes).toEqual([]);           // same scrollHeight → no style write
  if (orig) Object.defineProperty(el.style, "height", orig);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run** — Expected: FAIL (`writes` contains `"auto"` and `"120px"`).
- [ ] **Step 3: Implement** — replace the effect body:

```tsx
useLayoutEffect(() => {
  const el = ref.current;
  if (!el) return;
  const focused = document.activeElement === el;
  const current = parseFloat(el.style.height) || 0;
  // While focused: only grow, never reset (iOS caret desync). Otherwise: fit.
  if (!focused) el.style.height = "auto";
  const needed = Math.min(el.scrollHeight, maxHeight);
  if (needed > current || !focused) {
    if (needed !== current) el.style.height = `${needed}px`;
  }
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}, [props.value, maxHeight]);
```

and add `onBlur={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`; props.onBlur?.(e); }}` on the textarea (destructure `onBlur` from props).

- [ ] **Step 4: Run the component test file** — Expected: both tests PASS (the first test's rerender is unfocused, so it still fits).
- [ ] **Step 5: Commit** — `git commit -m "fix(ui): auto-grow textarea grows only while focused (iOS caret)"`

#### Task D.2: Light-mode tag diagnosis and fix

- [ ] **Step 1: Screenshot** on the e2e stack (Task 2.3 harness) with the seeded fixture: inventory list (grid + list view), item detail, scan review; Playwright `colorScheme: "light"` and `"dark"`; save under `apps/web/test-results/proof/tags/`. Read each by eye and list every tag whose text is hard to read in light.
- [ ] **Step 2: Measure** — for each flagged tag compute contrast with a 12-line Node script (WCAG luminance) on the fg/bg pairs from `globals.css` `--chip-*` (light block lines 51–55) and the `conditionColors` map; record ratios in the lane report.
- [ ] **Step 3: Failing test** (status-chip.test.tsx) — for the worst pair found, e.g. if `--chip-draft-fg/bg` fails:

```tsx
it("light-mode chip tokens all clear 4.5:1 (operator: tags unreadable in light mode, 2026-09-06)", () => {
  const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
  const light = css.split(":root.dark")[0];
  for (const tone of ["active", "draft", "sold", "neutral", "asset"]) {
    const fg = light.match(new RegExp(`--chip-${tone}-fg:\\s*(#[0-9A-Fa-f]{6})`))![1];
    const bg = light.match(new RegExp(`--chip-${tone}-bg:\\s*(#[0-9A-Fa-f]{6})`))![1];
    expect(contrast(fg, bg), tone).toBeGreaterThanOrEqual(4.5);
  }
});
```
with a local `contrast(hexA, hexB)` helper in the test (relative luminance per WCAG 2.1).

- [ ] **Step 4: Run** — Expected: FAIL on the pair(s) below 4.5:1 (if all pass, the culprit is the `conditionColors` map or the filter chips — repeat Steps 3–4 against those classes by rendering `item-detail`'s pill and reading computed classes; the fix target is whichever fails).
- [ ] **Step 5: Fix** the failing token/class values (darken fg or lighten bg until ≥ 4.5:1; keep the hue), re-run Step 4 — PASS.
- [ ] **Step 6: Re-screenshot** light + dark, verify by eye, SendUserFile both.
- [ ] **Step 7: Commit** — `git commit -m "fix(theme): light-mode tag contrast"`

#### Task D.3: Lane D PR — web suite, typecheck, lint, review record, push (approval), `gh pr create`.

### Lane E — Multi-value item specifics (web + tiny API check)

**Owned files:** `apps/web/src/hooks/use-scan-aspects.ts` (+test), `apps/web/src/components/capture/scan-aspects-section.tsx` (+test), `apps/web/src/components/listing/aspect-fill-sheet.tsx` (+test), `apps/web/src/hooks/use-required-aspects.ts`, `apps/web/src/components/capture/scan-flow.tsx` — **only** `buildAspects` and the `ScanAspectsSection` props (lines ~1488–1501); Lane C owns the header at ~861. Coordinate by line ranges; merge Lane C before Lane E in Phase 2.

**Interfaces:**
- `useScanAspects` returns `aspectValues: Record<string, string[]>`, `setAspectValue(name, values: string[])`, `toggleAspectValue(name, value)`.
- `ScanAspectsSection` props: `aspectValues: Record<string, string[]>`, `setAspectValue(name, values: string[])`; reads `aspects[name].cardinality` (`"SINGLE" | "MULTI"`, default SINGLE).

#### Task E.1: Hook state becomes string[]

- [ ] **Step 1: Failing test** (use-scan-aspects.test.ts — create if absent, one test)

```ts
it("toggleAspectValue adds and removes a value on a MULTI aspect and keeps arrays per aspect", () => {
  const { result } = renderHook(() => useScanAspects({ name: "AirPods", visionCategory: "Headphones" } as never));
  act(() => result.current.toggleAspectValue("Features", "Wireless"));
  act(() => result.current.toggleAspectValue("Features", "Bluetooth"));
  expect(result.current.aspectValues.Features).toEqual(["Wireless", "Bluetooth"]);
  act(() => result.current.toggleAspectValue("Features", "Wireless"));
  expect(result.current.aspectValues.Features).toEqual(["Bluetooth"]);
});
```
(match the hook's real constructor arguments from `use-scan-aspects.ts` lines 1–40.)

- [ ] **Step 2: Run** — FAIL (`toggleAspectValue is not a function` / type mismatch).
- [ ] **Step 3: Implement** — `useState<Record<string, string[]>>({})`; `setAspectValue(name, values: string[])`; `toggleAspectValue(name, value)` = add if absent else remove; every existing seeding/confirm path writes `[value]`; `confirmSuggestion` writes `[value]`.
- [ ] **Step 4: Run the hook tests** — PASS. **Step 5: Commit.**

#### Task E.2: ScanAspectsSection multi-select chips

- [ ] **Step 1: Failing test** (scan-aspects-section.test.tsx)

```tsx
it("MULTI aspects toggle chips independently and show the selected count", () => {
  const setAspectValue = vi.fn();
  render(<ScanAspectsSection {...baseProps}
    aspects={{ Features: { required: false, values: ["Wireless", "Bluetooth"], cardinality: "MULTI" } }}
    aspectValues={{ Features: ["Wireless"] }} setAspectValue={setAspectValue} />);
  fireEvent.click(screen.getByRole("button", { name: "Bluetooth" }));
  expect(setAspectValue).toHaveBeenCalledWith("Features", ["Wireless", "Bluetooth"]);
  expect(screen.getByText("1 selected")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** — in the chip `onClick` (line ~125): `const multi = aspect.cardinality === "MULTI"; const cur = aspectValues[name] ?? []; setAspectValue(name, multi ? (cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]) : (cur[0] === v ? [] : [v]));` selected = `cur.includes(v)`; free-text input writes `[text]`; render `{multi && cur.length > 0 && <span>{cur.length} selected</span>}` under the label.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit.**

#### Task E.3: AspectFillSheet multi-select

Same shape as E.2 on `aspect-fill-sheet.tsx` (`values` state becomes `Record<string, string[]>`, the sheet's save sends arrays). One test: "MULTI aspect keeps two selected chips". Commit.

#### Task E.4: scan-flow save path

- [ ] Update `buildAspects` in `scan-flow.tsx` to pass arrays through unchanged (it currently wraps a string as `[value]`), and the `ScanAspectsSection` props. Run `scan-flow.test.tsx` — PASS. Commit.

#### Task E.5: Lane E proof + PR — screenshots of a review with a MULTI aspect showing several selected chips (light + dark), web suite, typecheck, lint, review record, push (approval), `gh pr create`.

### Lane F — eBay sync gaps (API + seller-profile UI)

**Owned files:** `apps/api/src/routes/items.ts` (+test), `apps/api/src/lib/sync-worker.ts` (+test), `apps/api/src/marketplace/ebay-trading-builders.ts` (+test), `apps/api/src/marketplace/ebay-adapter.ts` (+test), `apps/api/src/db/schema.ts`, `apps/api/src/routes/seller-profile.ts` (+test), `apps/web/src/app/settings/seller-profile/page.tsx` (+test), `packages/shared/src/types.ts` (SellerProfile fields only).

#### Task F.1: "Title too long" is terminal and warned at save (gap 1)

- [ ] **Step 1: Failing test** (sync-worker.test.ts)

```ts
it('terminal-fails an eBay "Title too long." revise instead of 5 retries (live 2026-09-04: 15 min of Syncing…)', async () => {
  // arrange a claimed job whose syncItemListingRow throws new EbayTradingError('Title too long.', 21916635)
  // (use the file's existing job/claim mocks)
  await processDueSyncJobs();
  expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', lastError: expect.stringContaining('Title too long') }));
});
```

- [ ] **Step 2: Run** — FAIL (status pending, attempts 1).
- [ ] **Step 3: Implement** — in the worker catch: `const deterministicText = /title too long/i.test((err as Error).message); if ((err instanceof AppError && DETERMINISTIC.has(err.code)) || deterministicText) { …terminal branch… }`.
- [ ] **Step 4:** PASS. **Step 5:** second test in `items.test.ts`: `PATCH /items/:id with a 90-char title and an active eBay listing returns syncWarnings containing "eBay titles are limited to 80 characters"`; implement in the PATCH route next to the BO-3 warning: `if (typeof body.title === 'string' && body.title.length > 80 && listed.marketplace === 'ebay') syncWarnings.push(\`ebay: listing ${syncId} — eBay titles are limited to 80 characters (yours is ${body.title.length}); the sync will fail until you shorten it\`);`. Commit both.

#### Task F.2: Return policy, duration, handling time as seller settings (gap 3)

- [ ] **Step 1: Schema** — `apps/api/src/db/schema.ts` sellerProfiles: `ebayReturnsAccepted: boolean('ebay_returns_accepted').notNull().default(false)`, `ebayReturnDays: integer('ebay_return_days').notNull().default(30)`, `ebayHandlingDays: integer('ebay_handling_days').notNull().default(1)`. Shared `SellerProfile` type gains the three fields. `npm run db:push` is a deploy step (Phase 2), not a lane step.
- [ ] **Step 2: Failing builder test** (ebay-trading-builders.test.ts)

```ts
it('renders the seller return policy (accepted, 30 days, seller pays not asserted) and handling days from the seller profile', () => {
  const xml = buildAddFixedPriceItemXml({ ...baseInput, returnsAccepted: true, returnDays: 30, handlingDays: 3 }, 'T');
  expect(xml).toContain('<ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>');
  expect(xml).toContain('<DispatchTimeMax>3</DispatchTimeMax>');
});
```
- [ ] **Step 3:** FAIL. **Step 4:** Implement in `TradingListingInput` (`returnsAccepted?: boolean; returnDays?: 14 | 30 | 60; handlingDays?: number`) and `itemBody`: return policy element built from the flags (default unchanged: `ReturnsNotAccepted`), `DispatchTimeMax` from `handlingDays ?? dispatchTimeMax ?? 1`. **Step 5:** PASS.
- [ ] **Step 6: Adapter** — one test in `ebay-adapter.test.ts`: `buildTradingInput` reads the three fields from `marketplaceSpecific.sellerReturns` (populated by `applyShipFromOrigin`'s sibling `applySellerPolicies(userId, specific)` in listings.ts — Lane F owns adding that helper next to `applyShipFromOrigin`; it selects the three columns and merges `{ returnsAccepted, returnDays, handlingDays }` into the specific). Implement, PASS.
- [ ] **Step 7: Settings UI** — `apps/web/src/app/settings/seller-profile/page.tsx`: a "Returns & handling" group with a Returns accepted switch, a 14/30/60 select, and a 1–5 handling-days select; one test asserting the PATCH body carries `ebayReturnsAccepted`, `ebayReturnDays`, `ebayHandlingDays`. `seller-profile.ts` route zod accepts the three (booleans/ints, bounded). Implement, PASS, commit.

#### Task F.3: Item wins over listing-row shadows (gap 5)

- [ ] **Step 1: Failing test** (items.test.ts) — `PATCH /items/:id with aspects strips the listing rows' marketplaceSpecificFields.aspects before enqueueing the sync`; assert the `db.update(listings).set({ marketplaceSpecificFields: … })` call omits `aspects`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement next to the existing aspect-null-strip block (~636–654): when `body.aspects`, `body.category`, or `body.conditionNotes` is present, for each live eBay row delete `aspects` / `categoryId` (only when `body.marketplaceData?.ebay?.categoryId` was also sent) / `conditionDescription` from `marketplaceSpecificFields` in the same transaction. **Step 4:** PASS. Commit.

#### Task F.4: GetItem returns Description (gap 6)

- [ ] **Step 1: Failing test** (ebay-trading-builders.test.ts) — `buildGetItemXml` output contains `<DetailLevel>ItemReturnDescription</DetailLevel>`.
- [ ] **Step 2:** FAIL. **Step 3:** add the element before `</GetItemRequest>`. **Step 4:** PASS. **Step 5:** second test (ebay-adapter.test.ts): `getItemDetail` returns `description` from `Item.Description`; add `description: string | null` to `EbayItemDetail` and `parseGetItemVerification` (`String(item.Description ?? '') || null`). PASS. Commit.

#### Task F.5: Lane F gates + PR — API suite, typecheck, web test for the settings page + proof screenshot of the new settings group, review record, push (approval), `gh pr create`.

### Lane G — Listing content (API prompts) + Epson

**Owned files:** `apps/api/src/lib/vision.ts` (prompts only), `apps/api/src/lib/vision.test.ts`.

#### Task G.1: "I am selling" ban (done in Task 0.3 — verify)

- [ ] Run `vision.test.ts` — Expected: PASS including `bans the "I am selling" opener…`.

#### Task G.2: Encode the approved template (Task 0.1 step 1 answers)

- [ ] **Step 1: Failing test** — replace the assertions in `asks for a structured buyer-facing description…` with the approved shape. If the operator chose paragraphs over labelled sections, the test becomes:

```ts
expect(systemPrompt).toMatch(/description: .*150.*300 words/s);
expect(systemPrompt).not.toMatch(/Overview — /);
expect(systemPrompt).toMatch(/first (two|2).*sentences.*stand alone/is);
```
If they kept labelled sections, keep the current assertions. If they chose style seeding, add a test that `generateListingFields` includes `input.styleExamples` in the user prompt (new optional field `styleExamples?: string[]`, up to 3, appended under `SELLER'S OWN PAST DESCRIPTIONS (match this voice):`).
- [ ] **Step 2:** FAIL. **Step 3:** Edit the prompt paragraph to the approved wording (write it exactly as approved; no other change). **Step 4:** PASS. **Step 5:** Live sample: run `scratchpad/probe-gemini.ts desc` (reads the prompt from this lane's `vision.ts` — update its path) on 3 items, paste the output in the lane report. **Step 6:** Commit.

#### Task G.3: Epson re-sync (if Task 0.1 step 5 = go; Phase 2 after deploy)

- [ ] After Phase 2 deploy, trigger one sync: `POST /sync-log/retry` for listing `755a42a0-7cda-483f-8ee2-e399269dc34e` via the app (Settings → Sync log → Retry on the latest Epson row), or the operator edits any Epson field. Verify with the read-only GetItem probe (`scratchpad/ebay-getitem.mts`, `--config dev`) that the live Description ends with the footer and contains `<br>`.

---

## Phase 2 — Integration, proof, deploy (orchestrator, sequential)

### Task 2.1: Merge order

- [ ] Merge PRs in this order to keep conflicts to the two known shared files: A (api only) → F (api + settings page) → G (prompts) → B (inventory page) → C (headers, touches scan-flow ~861 and item-detail ≥457) → E (scan-flow ~1488 + hook/sections) → D (globals.css, item-detail top, textarea). After each merge: `git fetch && git merge origin/main` into the next lane, resolve, rerun that lane's tests.

### Task 2.2: Full gates on merged main

- [ ] `~/DHG/portage/.claude/scripts/vitest-locked.sh <checkout>/apps/api` — all pass; `… /apps/web` — all pass; `npm run typecheck`; `npm run lint` (0 errors, ≤ 27 warnings).

### Task 2.3: e2e stack proof

- [ ] Bring up the isolated stack from the merged checkout with the vision override (`scratchpad/e2e-vision.override.yml`, Doppler `dev`), `db:push` to port 5998, seed 201 items via `POST /items` in a loop (titles `E2E Item 001…201`, one with a MULTI `Features` aspect), then run: `e2e/scan-provenance.spec.ts` (E2E_SCAN_LIVE=1), plus a new `e2e/batch-proof.spec.ts` that screenshots inventory (page 2 at 25, page 3 at 100), item detail, edit page, scan review, settings profile, Porter tab, in light and dark. Verify every screenshot by eye; SendUserFile the set. Tear down with `down -v`.

### Task 2.4: Deploy

- [ ] `npm run db:push -w apps/api` against the live DB (host `127.2.0.1:5436`, credentials from Doppler dev) for the three seller-profile columns.
- [ ] Rebuild + recreate `portage-api` and `portage-app` from merged main; health checks.
- [ ] Doppler: `CHAT_PROVIDERS=gemini:gemini-3.8-flash,gemini:gemini-2.5-flash` in dev and prd; re-sync `.env`; recreate `portage-api`; confirm `docker exec portage-api node -e 'console.log(process.env.CHAT_PROVIDERS)'`.
- [ ] Task G.3 Epson re-sync.

---

## Phase 3 — Operator device verification

- [ ] Porter: ask for a Sennheiser item by brand, then "what does the Scan button do"; expect the item list and the app answer.
- [ ] Inventory: change page size to 25, page through; confirm 201 reachable.
- [ ] Every screen: user menu + theme toggle present; flip theme; tags readable in light.
- [ ] Scan review: type in Condition Notes and Description on iOS; caret stays where it is drawn.
- [ ] A MULTI aspect: select three chips; Save; the item's aspects carry all three.
- [ ] Epson listing on eBay: footer present, sections on separate lines.

## Self-review notes

- Spec coverage: A (A.1–A.5), B (B.1–B.2), C (C.1–C.3), D (D.1–D.2), E (E.1–E.5), F (F.1–F.4), G (G.1–G.3), H1 (F.1), H2 (C.4), H3 (F.2), H5 (F.3), H6 (F.4); pg_trgm (A.4); Doppler chain (2.4).
- Shared-file collisions: `scan-flow.tsx` (C header vs E aspects, disjoint line ranges, merge C before E); `item-detail.tsx` (C headers vs D `conditionColors`, disjoint ranges, merge C before D); `vision.ts` prompts (G only).
- Type consistency: `PageSize` from `pager.tsx` used in `page.tsx`; `HeaderActions` no props; `setAspectValue(name, string[])` in E.1/E.2/E.4; `EbayItemDetail.description` in F.4; `TradingListingInput.returnsAccepted/returnDays/handlingDays` in F.2.
