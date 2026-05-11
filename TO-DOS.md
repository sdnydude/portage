# TO-DOS

## Deferred from docs/CI pipeline ship - 2026-05-10 22:00

- **Backfill existing insight/decision_log embeddings** - Run embedding generation on pre-existing rows that were created before the embedding pipeline was wired up. **Problem:** 25/29 insights and 8/8 decision_logs have NULL embeddings because they were ingested before `embedding_utils.py` existed. Semantic search over these tables returns incomplete results. **Files:** `registry/embedding_utils.py`, `registry/models.py:Insight`, `registry/models.py:DecisionLog`. **Solution:** Write a one-shot backfill script that queries rows where `embedding IS NULL`, calls `get_embedding()`, and updates in batches.

- **Add docusaurus-search-local plugin** - Enable in-browser full-text search on the Docusaurus docs site. **Problem:** Users currently have no search bar on the docs site at `10.0.0.251:8017`. Registry hybrid search exists but has no frontend UI. In-browser FTS is a faster win. **Files:** `docs-site/docusaurus.config.ts`, `docs-site/package.json` (in AI Factory repo). **Solution:** `npm install @easyops-cn/docusaurus-search-local`, add plugin to config, rebuild + restart nginx.

- **Fix Dependabot vulnerabilities** - Address 1 high and 1 moderate vulnerability on the default branch. **Problem:** GitHub flagged vulnerabilities during push: "GitHub found 2 vulnerabilities on sdnydude/portage's default branch (1 high, 1 moderate)." **Files:** `package.json`, `package-lock.json` (specific packages TBD — check https://github.com/sdnydude/portage/security/dependabot). **Solution:** Run `npm audit`, update affected packages, verify tests pass.

## Future /ship candidates - 2026-05-10 22:00

- **Build AI Factory frontend search UI** - Add a search interface in the AI Factory web app that queries `POST /api/doc-pages/search`. **Problem:** The registry has 319 indexed doc chunks with hybrid RRF search working at 22ms, but there's no UI to query it. Only accessible via curl/API. **Files:** AI Factory frontend repo (TBD). **Solution:** React component with search input, debounced query, result cards showing title/heading_path/content preview.

- **Ingest AI Factory docs into registry** - Run doc_ingest.py on AI Factory's own documentation. **Problem:** Only Portage docs are indexed (319 chunks). AI Factory has its own docs that should be searchable. **Files:** `registry/doc_ingest.py`, AI Factory docs directory. **Solution:** Separate /ship run — follow EXPANSION_GUIDE.md.

- **Ingest DHS docs into registry** - Run doc_ingest.py on DHS project documentation. **Problem:** DHS docs not yet indexed for semantic search. **Files:** `registry/doc_ingest.py`, DHS docs directory. **Solution:** Separate /ship run — follow EXPANSION_GUIDE.md.
