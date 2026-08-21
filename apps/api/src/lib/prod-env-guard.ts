/**
 * Boot-time guard for env vars that MUST be present in production.
 *
 * Same class of failure as the 2026-07-28 CF_ACCESS_AUD outage (PR #269):
 * a key silently missing from the Doppler sync leaves a feature dead while
 * the API reports healthy. Refuse to boot instead, naming EVERY missing key
 * in one pass (aggregate, not first-fail) so a single restart shows the
 * whole gap.
 *
 * Only statically-required keys belong here. Provider-chain keys
 * (ANTHROPIC/GEMINI/… selected by VISION_PROVIDERS / CHAT_PROVIDERS) stay
 * runtime-checked by ai-client fail-over — enforcing them at boot would
 * brick provider experiments.
 *
 * Dev/test are exempt (no CF edge, ephemeral CI stacks).
 */
/**
 * A string = that key must be non-empty. An array = ANY ONE of the keys must
 * be non-empty (reported as 'A|B' when none is), for credentials the runtime
 * resolves with a fallback chain.
 */
export const PROD_REQUIRED_ENV: ReadonlyArray<string | readonly string[]> = [
  // Photo storage — every scan/upload dies without R2.
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  // eBay app credentials — OAuth connect, Taxonomy, Trading, Notification API.
  // Runtime uses EBAY_PROD_* when set, else EBAY_* (token-manager.ts,
  // ebay-credentials.ts) — so either keyset satisfies the guard.
  ['EBAY_CLIENT_ID', 'EBAY_PROD_CLIENT_ID'],
  ['EBAY_CLIENT_SECRET', 'EBAY_PROD_CLIENT_SECRET'],
  // Billing — checkout + webhook signature verification + the three price ids
  // billing.ts throws CONFIG_ERROR on at checkout time.
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_ANNUAL',
  'STRIPE_PRICE_CREDITS',
  // eBay Marketplace Account Deletion endpoint (compliance-mandatory for the
  // production keyset). Both drive the challenge-response hash; a missing
  // value silently fails every eBay handshake.
  'EBAY_DELETION_VERIFICATION_TOKEN',
  'EBAY_DELETION_ENDPOINT_URL',
];

/** Names of the missing requirements ('KEY' or 'KEY_A|KEY_B' for any-of groups). */
export function missingProdEnv(
  value: Partial<Record<string, unknown>>,
  nodeEnv: string,
): string[] {
  if (nodeEnv !== 'production') return [];
  const present = (key: string) => Boolean(String(value[key] ?? '').trim());
  const missing: string[] = [];
  for (const req of PROD_REQUIRED_ENV) {
    if (typeof req === 'string') {
      if (!present(req)) missing.push(req);
    } else if (!req.some(present)) {
      missing.push(req.join('|'));
    }
  }
  return missing;
}
