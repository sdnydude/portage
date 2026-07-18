# Graphify Dashboard Interface — Build & Verification Log

**Date:** 2026-07-17
**Prompt:** `prompts/004-graphify-dashboard-interface.md`
**Deliverable:** Interactive drill-down explorer for the code knowledge graph at `10.0.0.251:8018/explore/`

---

## 1. Research findings (regeneration behavior)

**Question:** does `graphify update .` regenerate the dashboard HTML, overwriting direct edits?

**Answer: YES — proven, not assumed.**

Evidence:

1. **Skill source** (`~/.claude/skills/graphify/SKILL.md`, Step 6): "Generate HTML always (unless `--no-viz`)" → `graphify export html` rewrites `graph.html` on every build. `references/update.md`: the `--update` flow ends with "run Steps 4–8 on the merged graph as normal" — Step 6 included.
2. **Live run proof** (this session): `graphify update .` output — `[graphify watch] graph.json, graph.html and GRAPH_REPORT.md updated in graphify-out`. Timestamps: `graph.html` and `graph.json` went from `2026-07-15 23:29` to `2026-07-17 04:01`.
3. **nginx** (`infra/graphify-nginx.conf`): root is `graphify-out/` with `index graph.html;` — so the landing page at `:8018` **is** the regenerated file. Direct edits to it are guaranteed to be destroyed.

**What survives regeneration — also proven:**

- graphify never wipes `graphify-out/`: Step 9 cleanup deletes only named `.graphify_*` temp files; `mkdir -p` only; a shrink guard (#479) even refuses to overwrite `graph.json` with a smaller graph. It backs up prior outputs into dated dirs (`2026-07-17/` created during this session's update).
- Empirical: dated dirs `2026-07-11..15/`, `.appbuild.log` (June 21), `cost.json` all persisted through the July 15 full rebuild — and **`explore/graph.html` (03:58) was untouched by the 04:01 regeneration**.
- `wiki/` is rewritten only by `graphify export wiki` (`--wiki` flag), not by plain `update` — confirmed by `references/exports.md` ("Only run this step if `--wiki` was explicitly given") and by the wiki surviving this session's update. Caveat: a future `--wiki` run WILL regenerate `wiki/index.md`, reverting the one-line pointer edit described below.

**Chosen approach:** a **separate client-side layer** — `graphify-out/explore/graph.html` — that fetches `../graph.json` and `../.graphify_labels.json` at runtime. It survives regeneration (graphify never writes/deletes that path) AND stays automatically current, because every rebuild refreshes the very data files it reads. Rejected alternatives: editing `graph.html` (overwritten — proven above); patching the generator (graphify is a pip/uv-installed third-party tool — template edits die on upgrade); a post-process re-inject step (fragile, needs a hook into every update path).

**File naming gotcha:** nginx's server-level `index graph.html;` applies to every directory, so the explorer file must be named `explore/graph.html` (not `index.html`) for `/explore/` to serve it — with `index.html` the URL returned a 266-byte autoindex listing. No nginx config change needed or made.

**Durability note:** `graphify-out/` is gitignored, so the canonical copy is tracked at `infra/graph-explore/graph.html` (same pattern as the portal in `infra/portal/`). Deploy = `cp infra/graph-explore/graph.html graphify-out/explore/graph.html`. The two were identical at ship time.

## 2. Data inventory (what the interface can present)

From `graphify-out/graph.json` (rebuilt this session: 4,717 nodes / 6,623 edges / 706 communities / 16 hyperedges, `built_at_commit` present):

- **Nodes:** `label`, `source_file`, `source_location` (L-number), `community`, `_origin` (ast/semantic), `file_type` (code 2218 / document 2124 / image 206 / concept 130 / rationale 35 at inventory time), optional `metadata.language` + `metadata.kind`.
- **Links:** `relation` (15 types — contains 3380, imports 1236, imports_from 927, calls 593, references, re_exports, method, extends, indirect_call, …), `source`/`target` (direction preserved even though the NetworkX graph is undirected), `confidence` (EXTRACTED 6531 / INFERRED 92), `confidence_score`, `weight`, `context` (~68% of edges), edge-level `source_file` + `source_location`.
- **Hyperedges:** 16 group relationships in `graph.hyperedges` (label, relation, member node ids).
- **`.graphify_labels.json`:** 702 community-id → name labels (served as application/json; new communities beyond the labeled set fall back to "Community N" in the UI).
- **`GRAPH_REPORT.md` / `wiki/*.md`:** narrative artifacts, linked from the explorer header; wiki is served `text/plain` (nginx MIME override), so its markdown links are non-interactive by design — the explorer is the interactive surface.
- **Dangling edge endpoints:** 0 (verified) — every link endpoint resolves to a node.

## 3. What was built

`graphify-out/explore/graph.html` — one self-contained file (no CDN, no libraries, no backend; all interactivity client-side per requirement 3):

- **Landing hierarchy:** overview → community → node, hash-routed (`#/`, `#/community/<id>`, `#/node/<id>`), browser back/forward works.
- **Overview:** corpus stats (nodes/edges/communities/hyperedges, source commit, data Last-Modified), top-20 god nodes by degree (clickable), edge-relation counts (styled as flat, non-clickable badges — no false affordance), 16 hyperedges expandable with member chips, all communities sorted by size with a live filter.
- **Community view:** label, member/internal-edge/external-edge counts, connected communities ranked by shared-edge count (clickable), members sorted by degree with kind badge + file path + live filter.
- **Node detail:** definition (file, line, community link, node id), relationships grouped by relation with direction arrows (→ outgoing / ← incoming from extractor source→target), neighbor links, INFERRED/AMBIGUOUS confidence badges (EXTRACTED unmarked, legend states this), per-edge source location and context text, hyperedge membership.
- **Search:** header box, debounced, ranks label-exact > label-prefix > label-contains > id > file-path with degree tiebreak, top 100, Enter opens first result, Esc clears. Unknown routes render a friendly not-found with a way back — no dead ends.
- **Theming:** dark default matching the portal palette (graphite `#14130f`, orange `#e8833a`, teal `#2aa198`), light theme via `prefers-color-scheme` + persistent toggle. Inline SVG favicon (no 404 console noise). Filter inputs carry aria-labels.
- **Freshness:** `fetch(..., { cache: "no-cache" })` — found live that heuristic browser caching served the pre-update graph after a rebuild; no-cache forces revalidation (304 when unchanged), so rebuilds are visible immediately.

Supporting edits:

- `graphify-out/wiki/index.md` line 3: the old static promise ("…then drill into god nodes for detail" atop a plain-text page with dead links) replaced with a pointer to the working `/explore/` interface. Survives `graphify update .`; would be reverted by a future `--wiki` export (re-apply the one line if so).
- `infra/graph-explore/graph.html`: tracked canonical copy.
- No nginx, docker-compose, or container changes. No container restart needed — files were added/edited in place inside the bind-mounted dir (no inode swap), verified live over HTTP after every change.

## 4. Verification (Definition of Done — observed live)

All via real browser (Playwright) against `http://10.0.0.251:8018`; screenshots in `docs/audits/2026-07-graphify-interface/`:

| Step | Evidence |
|---|---|
| Overview level (light + dark) | `01-overview.png`, `05-overview-dark.png` — real stats 4,713/6,623/702/16 pre-update |
| Community drill-down (click) | `02-community-api-app.png` — API App & Beta Routes: 92 nodes, 226 internal / 199 external edges, connected communities |
| Node 1: `app.ts` (click from community) | `03-node-app-ts.png` — definition L1, relations grouped 61/31/1 |
| Node 2: `createApp()` (click from neighbor link) | `04-node-createapp.png` — L34, INFERRED badge on indirect_call, edge context "argument" |
| Node 3: `useAuth()` (click from god-node chip) | `06-node-useauth-dark.png` — 125 edges, calls 64 / imports 60 |
| Search (typed "reverb") | `07-search-reverb.png` — 137 ranked matches with community + file |
| Node 4: `ReverbAdapter` (click from search) | `08-node-reverbadapter.png` — 11 method edges with real line numbers |
| Node 5: doc node "Reverb token-paste auth flow" (click from search) | `09-node-doc-tokenpaste.png` — document node, incoming/outgoing contains |
| **`graphify update .` run** | CLI output "graph.json, graph.html and GRAPH_REPORT.md updated"; graph.html mtime 07-15 23:29 → 07-17 04:01; `explore/graph.html` mtime unchanged; `/explore/` still HTTP 200 |
| Post-update re-verify | `10-overview-after-update.png` — explorer now shows the NEW graph (4,717 nodes, 706 communities, data timestamp 17 Jul 08:01 GMT) |
| Node 6 post-update: `stateSlug()` (click) | `11-node-after-update.png` — incoming calls from `.updateListing()` L187 / `.createListing()` L146 |
| Old promise grep | `grep -ril drill graphify-out/` → only `explore/graph.html` (backed by working interaction) and the new `wiki/index.md` pointer; the original "drill into god nodes" phrase is gone |
| Console | 0 errors on current loads (favicon 404 eliminated with inline data-URI icon) |

**Not observed / limitations, stated honestly:**
- Verified in headless Chromium via Playwright on the server, not in Stephen's own browser; viewport 780px-class. No physical-device pass.
- `graphify update .` (CLI) is the code-only update path; a full skill-driven `--update` with doc changes runs the same Steps 4–8 outputs, but was not separately executed.
- The `:8018` landing page remains the regenerated raw `graph.html` (vis-network). Making `/explore/` the landing page needs a one-line nginx `index` change — **not done** (infra change requires explicit approval). Say the word and it's a one-liner.

## 5. Deferred

- Optional: swap nginx `index` to land on the explorer (needs approval — infra).
- If a future `graphify export wiki` reverts `wiki/index.md`, re-apply the one-line `/explore/` pointer.
- `graphify update .` warning (pre-existing, unrelated to this work): `Node 4601 (id='portage_app') missing required field 'source_file'` and 5 zero-node JSON files — upstream graphify extraction quirks, surfaced here per honesty rules.
