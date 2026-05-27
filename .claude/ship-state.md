status: complete
phase: 7
feature: bulk image export — zip download of all photos for selected inventory items
approach: server-side streaming ZIP via fflate, two-endpoint design (prepare + download), DB-backed download tokens
complexity: complex
pr: https://github.com/sdnydude/portage/pull/88
completed_at: 2026-05-27T18:30:00Z

commits:
  - dfb1f3b feat: add POST /items/photos/export/prepare endpoint (TDD)
  - a8e7a03 feat: add export_tokens schema and wire DB insert into prepare endpoint
  - e39fea7 feat: add GET /items/photos/export token-auth ZIP streaming endpoint
  - 73ea238 feat: add ExportActionSheet with photo ZIP and eBay CSV export options
  - 3080626 feat: lower photo cap to 60, add 502 on total fetch failure, fix export UI errors
  - 31e34c9 fix: escape apostrophe in comps-search-sheet to pass lint

verification:
  typecheck: pass
  tests: 290/292 (2 pre-existing billing failures)
  lint: 0 errors, 25 pre-existing img warnings

deferred:
  - SSRF regression test
  - Per-photo server-side error logging
  - export_tokens cleanup job
