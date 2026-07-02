// Identifies Portage as a registered eBay application on every API/OAuth call.
// An anonymous Node `fetch` (no User-Agent) reads as a script to eBay's bot/ATO
// layer; a descriptive UA removes that signal.
//
// Lives in its own constant-only module (not token-manager or the adapter) so it
// has a single source of truth AND so the test mocks of those modules don't have
// to re-export it — a constants module is never mocked, so the real value always
// reaches both the OAuth calls (token-manager) and the API calls (adapter).
export const EBAY_USER_AGENT = 'PortageApp/1.0 (+https://portage.digitalharmonyai.com)';
