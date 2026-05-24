status: complete
phase: 7
feature: Buyer messaging — eBay read + reply via Trading API
approach: Trading API (XML) with OAuth2 tokens via X-EBAY-API-IAF-TOKEN header. GetMemberMessages for inbox, AddMemberMessageRTQ for replies. fast-xml-parser for XML handling.
complexity: complex
tdd: true
branch: feat/buyer-messaging
pr: https://github.com/sdnydude/portage/pull/84
completed_at: 2026-05-19T01:00:00Z

commits:
  - 911eb3b feat: add eBay buyer messaging backend — Trading API client, routes, schema, 20 tests
  - 5534173 feat: add buyer messaging frontend — conversations list, thread view, reply, unread badge
  - 3a60fdd fix: address 18 advisor review findings across messaging feature

verification:
  typecheck: pass (all 3 workspaces clean)
  tests: 227/227 pass (22 files, 20 new messaging tests)
  lint: 0 errors, 22 pre-existing warnings (none from new code)
  containers: all 4 healthy (portage-api, portage-app, portage-db, portage-rembg)
  endpoints:
    GET /messages: 200, ~5ms avg
    GET /messages/unread-count: 200, ~4ms avg
    GET /messages/nonexistent-key: 200 (empty array)
    POST /messages/test-key/reply (empty body): 400 INVALID_INPUT
    POST /messages/test-key/reply (>2000 chars): 400 INVALID_INPUT
    No-auth on GET /messages: 401
    No-auth on POST /messages/sync: 401
  regression:
    GET /health: 200 (3ms)
    GET /items: 200 (12ms)
    GET /listings: 200 (5ms)
    GET /orders: 200 (5ms)
    GET /seller-profile: 200 (5ms)
    GET /billing/status: 200 (5ms)
  schema: pushed, ebay_messages table confirmed

review:
  agents: silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
  critical_found: 3 (C1 direction bug, C2 N+1 query, C3 notification abort)
  important_found: 10 (all resolved)
  minor_found: 8 (all resolved)

deferred:
  - Sync pagination beyond page 1 (eBay returns max 100 per call)
  - parseGetMyMessages dead code cleanup
  - Reverb/Etsy messaging adapters
