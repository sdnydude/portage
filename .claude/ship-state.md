status: in_progress
phase: 6
feature: Listings CRUD — edit/update/delete from UI
approach: Fix & Complete — fix broken save, add marketplace sync, wire missing UI actions
complexity: simple (5 tasks)

plan:
  1: Add marketplace sync to PATCH /listings/:id
  2: Fix detail page save — title/desc to items, price to listings
  3: Add Publish, Archive, Relist buttons to detail page
  4: Add updateListing to hook + fix reverb type
  5: Add Archived filter tab to listings index

progress:
  task_1: complete
  task_2: complete
  task_3: complete
  task_4: complete
  task_5: complete

commits:
  - 6eb7db4: feat: add marketplace sync to listing PATCH + fix hook types
  - b0f2b83: fix: detail page save now persists title/description to items table
  - c66363c: feat: add Publish, Archive, and Relist buttons to listing detail page
  - 07d0ec9: feat: add Archived filter tab and Reverb to listings index
  - a250817: fix: review fixes — error states, aria labels, address dirty tracking

verification:
  typecheck: pass (all 3 workspaces)
  lint_our_files: 0 errors, 1 warning (pre-existing img tag)
  lint_global: 1 error in settings/marketplace/page.tsx (pre-existing, not our change)
  tests: no test files exist for API
  services: portage-db healthy, portage-api healthy, portage-app unhealthy (needs rebuild with new code)

cleanup_needed:
  - f83e75b: chore: test commit-log hook (test commit — revert before PR)
  - 296c944: fix: update ship-state progress + make commit-log hook portable (mixed — has real fix)
  - 1abe448: chore: hook debug test (test commit — revert before PR)

review:
  agents: silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
  critical_fixed: 2 (userId guard on db.update, AppError re-throw in catch blocks)
  important_fixed: 6 (publish-with-unsaved, item fetch outside try, typed updates, finally block, modal text, invariant comments)
  deferred_to_future:
    - Duplicate Listing type in hook vs @portage/shared (nullability diverged)
    - statusConfig Record<string> should use exhaustive key union
    - Duplicate editable field / confirmation modal patterns (extract components)
    - Test coverage (no API tests exist — listings.test.ts recommended)
    - Three independent loading flags (consolidate to pendingAction)

deferred: []
