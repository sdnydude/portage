<objective>
Execute the EDIT and GRAPHICS sections of the docs audit worklist: bring every existing Portage doc and graphic to current-codebase accuracy and consistent editorial quality. This is the correction pass — new sections come in the next prompt, so resist adding content beyond what a fix requires.
</objective>

<context>
Input is the completed audit from the prior pass:
@./docs/audits/2026-07-docs-audit.md
@./docs/audits/2026-07-docs-audit-worklist.md
Read CLAUDE.md for architecture ground truth. Docusaurus source is website/docs/ with sidebars and static assets in website/static/img/; repo working docs live in docs/. Docs deploy via .github/workflows/deploy-docs.yml on push to website/** — a broken build blocks the pipeline, so the site must build clean.
</context>

<team>
Model policy: orchestrator and ALL subagents run on Fable (claude-fable-5); dispatch every Agent call with model: "fable" explicitly.
Same two roles, same parallelization rule (batch independent files simultaneously):
- Senior engineering writer (docs-writer agent): applies accuracy fixes, rewrites stale sections against current code.
- Technical editor (general-purpose agent): second-pass review of every changed file — consistency of terminology (one canonical name per feature), heading hierarchy, link integrity, tone. Editor reviews writer output; writer does not self-approve.
</team>

<requirements>
1. Work the worklist in order. Every EDIT line gets done or gets an explicit skip reason logged — no silent drops.
2. Stale-fact fixes must state the current truth, verified at edit time (paths, ports, commands, API names, feature status). Verification sources, in order of authority: code itself, merged PR notes (`gh pr view`), CodeGraph (symbol lookups — codegraph_search/callers/callees, never grep for code), graphify knowledge graph (:8018), DHG Registry KB search (10.0.0.251:8011). grep only for non-code files and string-literal sweeps. Never carry a claim forward unverified; never guess — if a fact can't be verified, flag it for Stephen instead of writing it.
2a. API docs (website/docs/api/): every edited endpoint entry re-verified against apps/api/src/routes/ — method, path, auth, request/response shape from the actual route handler and its Zod schemas, not from the old doc text.
3. Merge/delete verdicts: when the audit says merge-into or delete, do it — leave a pointer stub only where inbound links exist.
4. GRAPHICS lines: update hand-authored SVGs (architecture-*, ebay-trade-first-*, memory-*) to match current architecture; keep light/dark variants in sync; delete unreferenced images the audit marked orphaned; keep verification screenshots untouched (historical evidence).
5. SVG editing standard: preserve each file's existing visual language (colors, fonts, layout grammar) — corrections, not redesigns. Redesigns belong to the next prompt.
6. Sidebars: fix orphan pages (add to sidebar or delete per verdict); confirm no sidebar entry points at a removed file.
</requirements>

<constraints>
- No new sections, no new pages, no new diagrams — that's prompt 003. Fix-in-place only. This boundary exists so review diff stays reviewable and rollback stays clean.
- Do not touch apps/, packages/, docker-compose.yml, or any code — docs and static assets only.
- Session reports and ship-log entries: fix factual errors only, never restyle.
</constraints>

<output>
- Edited files in place under website/docs/, docs/, website/static/img/.
- `./docs/audits/2026-07-edit-pass-log.md` — one line per worklist item: done / skipped+reason, files touched.
</output>

<verification>
Before declaring complete:
- `cd website && npm run build` (or the docs-site build command in .github/workflows/deploy-docs.yml) passes with zero broken-link warnings.
- Grep the corpus for known-stale markers and confirm zero hits outside historical records: voice endpoints (/porter/transcribe, /porter/speak), etsy auth routes, listings/[id] as an edit surface, dhg-stt, dhg-tts.
- Every worklist EDIT/GRAPHICS line appears in the pass log.
- Editor role has signed off on every changed file (log which agent reviewed what).
</verification>

<success_criteria>
Docs build clean; no page contradicts the current codebase; every worklist EDIT/GRAPHICS item is done or explicitly skipped with a reason.
</success_criteria>
