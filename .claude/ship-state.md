status: complete
phase: 7
feature: CI/CD infrastructure + Unified Docusaurus docs site + Registry semantic search ingest pipeline
approach: Self-hosted GitHub Actions runner + Docusaurus in AI Factory repo + nginx serving + registry doc_pages pipeline + search UI
complexity: complex
tdd: no

spec: |
  Layer 1: GitHub Actions Self-Hosted Runner
    - Install runner on g700data1 as systemd service
    - Register with portage repo (per-repo, not org)
    - Label: self-hosted, linux, g700data1

  Layer 2: Docusaurus Docs Site (in AI Factory repo)
    - Single-instance with Portage docs initially (multi-instance later)
    - Portage 27 pages copied from portage/website/docs/
    - Nginx container (dhg-docs) serves built site on port 8017
    - docusaurus-search-local plugin for in-site search

  Layer 3: Registry Pipeline
    - Fix insight/decision_log embedding (Vector 1536→768, wire get_embedding, backfill)
    - doc_pages table (FTS + pgvector 768-dim)
    - Upsert by (project_name, source_file, chunk_index) + mark-and-sweep stale cleanup
    - Hybrid search via RRF (reciprocal rank fusion)
    - Ingest as registry/doc_ingest.py (not standalone script)
    - Chunking: heading boundaries + max 1500 chars with 200 char overlap

  Layer 4: CI/CD
    - GitHub Actions workflow: push website/** → build → rsync → ingest
    - Runs on self-hosted runner

  Acceptance Criteria:
    1. actions-runner systemd service running, visible in GitHub Runners
    2. http://10.0.0.251:8017 serves docs with working search bar
    3. POST /api/doc-pages/search returns relevant chunks with embeddings
    4. POST /api/insights generates embedding on ingest
    5. Push triggers workflow → rebuild + re-ingest
    6. Ingest is idempotent with stale chunk cleanup
    7. Expansion guide documented

plan:
  task_1: Install GitHub Actions self-hosted runner + systemd service
  task_2: Fix insight/decision_log embedding pipeline (migration 016, embedding_utils.py, backfill)
  task_3: DocPage model + Alembic migration 017
  task_4: doc_pages schemas + endpoints (upsert w/ embedding, hybrid RRF search)
  task_5: Register router + unified search + deploy registry
  task_6: Docusaurus site in AI Factory repo + nginx on port 8017 + search plugin
  task_7: registry/doc_ingest.py (chunk + embed + POST + mark-and-sweep)
  task_8: GitHub Actions CI/CD workflow
  task_9: E2E verification + expansion guide

evolution_refinements:
  - Docusaurus lives in AI Factory repo (cross-project home)
  - Ingest in registry/doc_ingest.py (testable, shares models)
  - Max chunk 1500 chars with 200 char overlap
  - Mark-and-sweep stale chunk cleanup
  - Expansion guide as final deliverable

deploy_order: runner (task 1) → registry pipeline (tasks 2-5) → docs site (task 6) → ingest + CI/CD (tasks 7-8) → verify (task 9)

completed:
  - task_1: Runner installed + systemd active (2026-05-11)
  - task_2: embedding_utils.py + migration 016 (Vector 1536→768, decision_log embedding cols)
  - task_3: DocPage model + migration 017
  - task_4: doc_pages_schemas.py + doc_pages_endpoints.py (upsert, bulk, hybrid RRF search, delete)
  - task_5: Router registered in api.py + search_api.py user_id fix + deploy + verify
  - task_6: Docusaurus 3.10.1 site in AI Factory repo + nginx dhg-docs container on port 8017
  - task_7: doc_ingest.py — 319 chunks ingested from 27 Portage docs
  - task_8: deploy-docs.yml updated for self-hosted runner pipeline
  - task_9: E2E verification (all 8 checks pass) + EXPANSION_GUIDE.md

verification_results:
  test_suite: 93/93 passed (12 files, 1.43s)
  runner: active (systemd)
  registry_api: healthy
  doc_pages_total: 319
  docs_site: HTTP 200 (port 8017)
  search_result: "architecture/overview.md — Listing Creation" for "marketplace adapter architecture"
  insights_embedding: 4/29 have embeddings (new pipeline working)
  decision_logs_embedding: 0/8 (all pre-fix, new ones will get embeddings)
  containers: dhg-docs Up, dhg-registry-api Up (healthy)
  regression: all existing endpoints return 200 (insights, decision-logs, search, sources, healthz, metrics)
  performance_baselines:
    POST_doc_pages_upsert: 40ms
    GET_doc_pages_list: 4ms
    POST_doc_pages_search_RRF: 22ms
    GET_unified_search_docs: 17ms
    GET_docs_site_homepage: 0.4ms
    GET_docs_site_page: 0.3ms
    POST_insights: 36ms
    GET_healthz: 0.9ms

review:
  agents_deployed: 6 (silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier)
  critical_issues: 0
  important_issues: 8 (all fixed)
  minor_issues: 3 (deferred)
  fixes_applied:
    - "list_sources missing doc_pages — added shared_tables loop with no user_id filter"
    - "search_api.py docstring/param missing 'docs' source — updated both"
    - "DocPageSearch.limit unbounded — added Field(ge=1, le=100)"
    - "DocPageBulkIngest allows empty pages — added min_length=1"
    - "bulk_ingest missing HTTPException pass-through — added except HTTPException: raise"
    - "delete_project_pages missing synchronize_session=False — added"
    - "All error handlers: added logger.error before raise, stopped leaking detail=str(e)"
    - "list_sources transaction poisoning — added db.rollback() in except blocks"
  minor_also_fixed:
    - "SOURCE_TABLES refactored to NamedTuple for readability"
    - "DocPageCreate added Field constraints (min_length, max_length, ge)"
    - "Upsert returns 201 on create, 200 on update (correct REST semantics)"
  re_verification: all endpoints pass, 93/93 tests, Documentation count=319, upsert 201/200 verified

deferred:
  - AI Factory doc conversion (separate /ship)
  - DHS doc conversion (separate /ship)
  - Multi-instance Docusaurus (when second project is ready)
  - AI Factory frontend search UI
  - docusaurus-search-local plugin (in-browser FTS)
  - Backfill existing insights/decision_logs embeddings
