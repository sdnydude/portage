status: in_progress
phase: 6
deferred: |
  - Bare catch in createListing publish (ebay-adapter.ts:115) — swallows error, log has no details
  - Bare catch in getListingStatus (ebay-adapter.ts:170) — masks bugs as 'unknown'
  - Silent delete failure in handleDelete (page.tsx:88) — no user feedback on error
feature: eBay Browse API comparable pricing — on-demand comps button on item detail/scan result
approach: eBay Browse API search_by_keyword, new GET /api/items/:id/comps endpoint, frontend comps button
complexity: simple
spec: |
  1. New API endpoint GET /api/items/:id/comps — uses item name/description to search eBay Browse API
  2. Returns array of comps: title, price, condition, sold date, thumbnail URL, eBay listing URL
  3. Two modes: sold items (pricing history) and active listings (current market) — separate arrays
  4. eBay OAuth: reuse existing marketplace account tokens; require connected eBay account
  5. Frontend: "Check Comps" button on item detail/scan result → card list with avg/median price summary
  6. Rate limiting: client-side debounce, server logs API calls, no persistent storage
  7. Edge cases: no eBay account → prompt to connect; no results → message; API error → graceful fallback
