<objective>
Execute the NEW section of the docs audit worklist: add the missing sections, subsections, and graphics that close documentation gaps and differentiate Portage. This is the value-add pass — the corpus is already accurate (prompt 002), so everything here is net-new content that makes the docs sell the product, not just describe it.
</objective>

<context>
Inputs:
@./docs/audits/2026-07-docs-audit.md (gap list + differentiation opportunities)
@./docs/audits/2026-07-docs-audit-worklist.md (NEW section)
@./docs/audits/2026-07-edit-pass-log.md (what prompt 002 changed)
Read CLAUDE.md for ground truth. Docusaurus lives in website/docs/ + website/static/img/; design tokens for graphics: Forest Green #2D5A27 primary, Instrument Sans display, Plus Jakarta Sans body, JetBrains Mono — match the existing hand-authored SVG visual language (see architecture-system-overview.svg, ebay-trade-first-workflow.svg as reference). Every diagram needs light + dark variants (*-dark.svg convention).
</context>

<team>
Model policy: orchestrator and ALL subagents run on Fable (claude-fable-5); dispatch every Agent call with model: "fable" explicitly.
- Senior engineering writer (docs-writer agent): drafts new sections against the code — every claim verified at write time. Verification sources, in order of authority: code, merged PR notes (`gh pr view`), CodeGraph (symbol lookups, never grep for code), graphify (:8018), DHG Registry KB search (10.0.0.251:8011) for decisions/rationale. grep only for non-code files and string literals. Never guess, never assume — unverifiable claims get flagged to Stephen, not written. New API doc pages built from the route handlers + Zod schemas in apps/api/src/routes/, not from memory.
- Technical editor (general-purpose agent): reviews every new page for clarity, consistency with the corrected corpus, and reader flow; verifies new pages are cross-linked from related existing pages, not orphaned.
Dispatch independent new-page drafts in parallel batches; editor reviews behind the writers.
</team>

<requirements>
1. Build every NEW worklist item. Beyond the worklist, thoroughly consider what a prospective seller, a new developer, and a future maintainer each still can't find — go beyond the basics and add what genuinely helps, but log each addition with a one-line justification so scope stays auditable.
2. Differentiation content — make the distinct capabilities first-class documented features with diagrams where a picture beats prose:
   - AI-first scanning (vision provider chain, item recognition to draft listing)
   - Trade-First eBay publish (why Trading API, insert-first idempotency, silent-fail detection via listing-id prefix)
   - Three-interface listing flow (Conversational / Swipe / Hybrid)
   - Porter assistant (SSE streaming, tools, action pills)
   - CF Access passwordless auth flow
2a. Infrastructure section — currently barebones; develop it fully as a first-class section. Cover EVERY piece of the running infrastructure with proper depth: portage-db (5436), portage-api (8016), portage-app (3002), portage-rembg, dhg-docs nginx (8017), portage-graph nginx (8018), Cloudflare tunnel + Access (config in infra/cloudflared/), Doppler secrets flow, R2 image storage + /img-cdn rewrite, GitHub Actions self-hosted runner + deploy-docs pipeline, DHG Registry integration (8011), monitoring/observability as actually wired. Each piece gets: what it is, how it's deployed (image-baked vs opt-in dev overlay), how it connects, how to operate/rebuild it. High-quality SVG diagrams required — a full-stack infrastructure map plus per-subsystem detail diagrams (request path, deploy path, secrets path), light + dark variants, matching existing visual grammar. Verify every port, container name, and connection against docker-compose.yml and infra/ before drawing it — no diagram ships with an unverified edge.
3. New graphics: SVGs matching the existing visual grammar, light + dark variants, referenced from at least one page each — no orphan assets.
4. Every new page: added to the correct sidebar, cross-linked from at least one existing related page, front-matter consistent with neighbors.
5. New subsections inside existing pages: match the host page's heading depth and voice.
</requirements>

<constraints>
- Zero-defect publication gate: no placeholder text, no TODO markers, no lorem, no test data, no stray screenshots — these docs deploy publicly on push to website/**. Inspect every new image before referencing it.
- Docs and static assets only — no code changes.
- Do not re-edit pages prompt 002 already corrected except to add the planned cross-links.
</constraints>

<output>
- New pages under website/docs/<section>/, new SVGs under website/static/img/ (with -dark variants), sidebar updates.
- `./docs/audits/2026-07-new-content-log.md` — every page/graphic added: path, worklist line or justification, cross-links added, editor sign-off.
</output>

<verification>
Before declaring complete:
- Docs site builds clean with zero broken-link warnings.
- Render the built site (docker or local build output) and visually confirm each new diagram in BOTH light and dark mode — screenshot each, save to website/static/img/verification/docs-refresh/.
- Confirm every new SVG is referenced by a page (grep filenames against website/docs/).
- Every NEW worklist line appears in the content log as done or skipped+reason.
</verification>

<success_criteria>
All gap-list and differentiation items shipped; new graphics render correctly in both themes with visual proof; no orphan assets; build clean; a reader can now understand what makes Portage different from the docs alone.
</success_criteria>
