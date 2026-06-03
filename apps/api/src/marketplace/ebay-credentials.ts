import type { Env } from '../lib/env.js';

type EbayCredentialConfig = Pick<
  Env,
  'EBAY_SANDBOX' | 'EBAY_CLIENT_ID' | 'EBAY_CLIENT_SECRET' | 'EBAY_PROD_CLIENT_ID' | 'EBAY_PROD_CLIENT_SECRET'
>;

/**
 * Selects the eBay OAuth credentials for the user-authorization flow (consent,
 * code exchange, and token refresh). In production (EBAY_SANDBOX=false) the
 * production keys are used, falling back to the base keys if the prod-specific
 * vars are unset. In sandbox mode the base keys are always used.
 */
export function getEbayUserFlowCredentials(
  config: EbayCredentialConfig,
): { clientId: string | undefined; clientSecret: string | undefined } {
  const useProd = !config.EBAY_SANDBOX;
  return {
    clientId: useProd ? (config.EBAY_PROD_CLIENT_ID || config.EBAY_CLIENT_ID) : config.EBAY_CLIENT_ID,
    clientSecret: useProd ? (config.EBAY_PROD_CLIENT_SECRET || config.EBAY_CLIENT_SECRET) : config.EBAY_CLIENT_SECRET,
  };
}
