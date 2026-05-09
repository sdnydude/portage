status: complete
phase: 7
feature: Critical 3+ — Dashboard spinner, navigation, settings pages, /users/me, demo promotion
approach: Direct fixes + new API endpoints + real settings pages
complexity: simple
commits:
  - 949a8dd fix: resolve dashboard infinite spinner on cold load
  - 84ba9ee feat: restructure TabBar to Home/Inventory/Scan/Orders/More
  - ad03728 feat: expand More page with full settings navigation
  - aac0eac feat: add GET/PATCH /users/me and GET /users/me/marketplace-accounts
  - f86fe1b feat: add profile settings page with display name and address
  - cad02be feat: add marketplace accounts settings page
  - 1fbbe74 feat: add help & support page with FAQ accordion
  - 404be55 feat: add notification preferences page with toggle switches
  - b5f0f33 fix: review fixes — error states, aria labels, address dirty tracking
  - 922eabd fix: prevent toggle race condition in notification preferences
completed_at: 2026-05-09T21:20:00Z
