status: in_progress
phase: 6
feature: C1 — Fix order sync assigns wrong listing to incoming orders
approach: Add marketplaceListingId to MarketplaceOrderResult, parse from each adapter's API response, match in order sync
complexity: simple (3 tasks)

plan:
  1: Add marketplaceListingId to MarketplaceOrderResult + update all 3 adapters
  2: Fix order sync matching logic
  3: Rebuild shared package + API container, verify end-to-end

progress:
  task_1: complete
  task_2: complete
  task_3: complete

commits:
  - 2c640e3: feat: add marketplaceListingId to MarketplaceOrderResult in all adapters
  - cb95aec: fix: order sync matches by marketplaceListingId instead of first active
  - 9fcac4a: fix: review fixes — marketplace filter, Reverb sync, null type, error logging

verification:
  typecheck: pass (all 3 workspaces)
  lint_our_files: 0 errors, 0 warnings
  lint_global: 1 pre-existing error in settings/marketplace/page.tsx
  services: portage-db healthy, portage-api healthy
  regression: auth guards correct (401 on /items, /orders)
  performance: health 4.2ms
  tests: no test files exist

review:
  agents: silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
  critical_found: 3
  critical_resolved: 3
  important_found: 3
  important_resolved: 3
  minor_deferred: 2
  fixes:
    - "Added eq(listings.marketplace) filter to prevent cross-marketplace ID collision"
    - "Added Reverb to adapter switch (was silently routing to EtsyAdapter)"
    - "Fixed catch block: logger.error + full err object + userId"
    - "Changed marketplaceListingId type to string | null (was string with '' sentinel)"
    - "Fixed Etsy String(0) edge case with null check"
    - "Added isNotNull(listings.marketplaceListingId) guard to DB query"

deferred:
  - Missing shippingAddress column on orders table
  - Hardcoded marketplaceFees: 0 for Etsy and Reverb
  - Lost soldAt timestamps from marketplace APIs (using NOW() instead)
  - Multi-item eBay orders only sync first line item
  - No test coverage for order sync
