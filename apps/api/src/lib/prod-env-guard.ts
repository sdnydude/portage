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
export const PROD_REQUIRED_ENV = [
  // eBay Marketplace Account Deletion endpoint (compliance-mandatory for the
  // production keyset). Both drive the challenge-response hash; a missing
  // value silently fails every eBay handshake.
  'EBAY_DELETION_VERIFICATION_TOKEN',
  'EBAY_DELETION_ENDPOINT_URL',
] as const;

export type ProdRequiredEnvKey = (typeof PROD_REQUIRED_ENV)[number];

export function missingProdEnv(
  value: Partial<Record<string, unknown>>,
  nodeEnv: string,
): ProdRequiredEnvKey[] {
  if (nodeEnv !== 'production') return [];
  return PROD_REQUIRED_ENV.filter((key) => !String(value[key] ?? '').trim());
}
