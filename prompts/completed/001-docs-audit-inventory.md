<objective>
Produce a complete, verified audit of ALL Portage documentation and documentation graphics. This audit is the work order for two follow-up passes (edit/update, then new content), so every finding must be specific enough for a different session to act on without re-deriving it. Nothing gets edited in this pass — audit only.
</objective>

<context>
Portage is an AI-powered personal effects inventory + multi-marketplace seller app (eBay live, Reverb live, Etsy parked). Docs ship publicly via Docusaurus (website/docs/, served at 10.0.0.251:8017) and internally via repo working docs (docs/). The product has moved fast — Trade-First eBay lifecycle, CF Access auth, responsive shell R0/R1, tutorial hub — and docs are known to lag reality. Read CLAUDE.md first for current architecture ground truth; treat its Progress section and docs/TODO.md as the freshness baseline.

Audit corpus:
- website/docs/ — all sections (api, appendix, architecture, design, development, frontend, reference, ship-log, team-process, top-level .md files)
- docs/ — working docs (TODO.md, PORTAGE_HISTORY.md, ebay-api-reference.md, trade-first-burndown.md, secrets-guide.md, ADMIN_PLAN.md, brand/, design/, research/, session-reports/, labs/, superpowers/)
- website/static/img/ — ~222 files including hand-authored SVGs (architecture-*, ebay-trade-first-*, memory-*) and verification screenshots
- README.md and any *.md at repo root that documents the product
- API documentation explicitly included: website/docs/api/ must be verified endpoint-by-endpoint against apps/api/src/routes/ — every documented route checked for existence, method, path, auth requirement, and request/response shape; every live route checked for a doc entry (undocumented routes are gaps).
</context>

<sources_of_truth>
Auditors verify claims against these sources, in this order of authority:
1. Code as it exists today — apps/api, apps/web, packages/shared, docker-compose.yml. Final arbiter on any conflict.
2. Merged PR notes — `gh pr list --state merged` + `gh pr view <n>` for what shipped, when, and why (Trade-First #133, CF Access #168–172, Reverb #173–177, listing-hub #207–213, responsive shell #229, tutorials #231, and any others touching the doc under audit).
3. CodeGraph — codegraph_search / codegraph_callers / codegraph_callees / codegraph_node for symbol-level verification (does this function/route/type still exist, who uses it).
4. Graphify knowledge graph — graphify-out/ (served at :8018) for architecture/relationship questions.
5. DHG Registry KB search — `POST http://10.0.0.251:8011/api/kb/search` with project_name "portage" for decisions, bug fixes, ship sessions, insights explaining WHY something is the way it is.

Tool-order rule (standing instruction, non-negotiable): code symbol lookups go through CodeGraph/Serena, never grep. grep is permitted ONLY for non-code files (the docs corpus itself) and string literals (error messages, config values, stale-marker sweeps). Using grep to answer "does function X exist" or "who calls Y" is a violation.

Research discipline: never guess, never assume, never fabricate. Every factual claim in the audit must carry evidence (file:line, PR number, KB citation, or tool output). If a fact cannot be verified from these sources, mark it UNVERIFIED and list it in an open-questions section for Stephen — do not resolve ambiguity by assumption. If the task itself is ambiguous at any point, stop and ask rather than picking silently.
</sources_of_truth>

<team>
Model policy: orchestrator and ALL subagents run on Fable (claude-fable-5). Dispatch every Agent call with model: "fable" explicitly — do not downgrade to sonnet/haiku for any role.
Use two subagent roles, dispatched in parallel batches for independent doc sections (invoke all independent agents simultaneously, not sequentially):
- Senior engineering writer (docs-writer agent): accuracy vs. codebase — does each claim match apps/api, apps/web, packages/shared, docker-compose.yml as they exist today?
- Technical editor (general-purpose agent with an editorial brief): structure, clarity, consistency, redundancy, tone, information architecture across the whole corpus.
</team>

<analysis_requirements>
Thoroughly analyze every file. For each doc, record:
1. Accuracy defects — stale facts (removed voice feature, parked Etsy, retired listings/[id] page, old port numbers, Business-Policies-era eBay claims), wrong paths, dead links, drifted commands. Verify claims against the code before flagging; cite file:line evidence for each defect.
2. Structure defects — misplaced content, duplicated content across files (e.g. secrets-guide.md vs canonical Doppler docs), missing cross-links, orphan pages not in sidebars.
3. Gaps — sections that should exist and don't (per-feature docs missing for shipped features: tutorial hub, responsive shell, photo reorder, GTC sweep, Reverb publish, messages/conversations). Known gap to audit in depth: the Infrastructure section is barebones — inventory every running infrastructure piece (all docker-compose services, CF tunnel/Access, Doppler, R2, nginx sites :8017/:8018, CI runner, Registry :8011) and record exactly which are documented, which are not, and which have no diagram coverage.
4. Graphics audit — for every SVG and referenced image: still accurate? referenced by any page? light/dark variants consistent? Flag unreferenced images and diagrams contradicting current architecture.
5. Differentiation opportunities — places where docs could sell what makes Portage distinct (AI-first scanning, Trade-First publish reliability, three-interface listing flow, Porter assistant) but currently read as generic.
</analysis_requirements>

<constraints>
- READ-ONLY pass: no file edits, no deletions. Editing before the full picture exists produces rework — the follow-up prompts consume this audit.
- Do not audit .claude/, node_modules, graphify-out/, or generated ship-log content beyond spot-checking that generation is still wired.
- Ignore obvious typo-level nits in session-reports/ (historical records — accuracy of the record matters, polish does not).
</constraints>

<output>
Save the audit to:
- `./docs/audits/2026-07-docs-audit.md` — master report: per-file verdict table (keep / fix / rewrite / delete / merge-into), each defect with file:line evidence, gap list, graphics disposition list, differentiation opportunity list. Rank fixes by reader impact.
- `./docs/audits/2026-07-docs-audit-worklist.md` — flat, ordered checklist the next prompt executes: one line per action, grouped into EDIT (existing files), GRAPHICS (update/delete/create), NEW (sections to add).
</output>

<verification>
Before declaring complete:
- Every file in the corpus appears in the verdict table (count files on disk, count table rows, numbers must match — state both counts).
- Spot-check 5 random "accurate" verdicts yourself against the code.
- Every defect row has file:line evidence; no defect may say "probably" or "likely".
</verification>

<success_criteria>
A session with zero prior context could execute the worklist top-to-bottom without opening the master report, and the master report justifies every worklist line.
</success_criteria>
