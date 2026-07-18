import { getEbayUserFlowCredentials } from './ebay-credentials.js';

describe('getEbayUserFlowCredentials', () => {
  it('returns production credentials when EBAY_SANDBOX is false', () => {
    const creds = getEbayUserFlowCredentials({
      EBAY_SANDBOX: false,
      EBAY_CLIENT_ID: 'sandbox-id',
      EBAY_CLIENT_SECRET: 'sandbox-secret',
      EBAY_PROD_CLIENT_ID: 'prod-id',
      EBAY_PROD_CLIENT_SECRET: 'prod-secret',
    });
    expect(creds).toEqual({ clientId: 'prod-id', clientSecret: 'prod-secret' });
  });

  it('returns sandbox credentials when EBAY_SANDBOX is true, ignoring prod values', () => {
    const creds = getEbayUserFlowCredentials({
      EBAY_SANDBOX: true,
      EBAY_CLIENT_ID: 'sandbox-id',
      EBAY_CLIENT_SECRET: 'sandbox-secret',
      EBAY_PROD_CLIENT_ID: 'prod-id',
      EBAY_PROD_CLIENT_SECRET: 'prod-secret',
    });
    expect(creds).toEqual({ clientId: 'sandbox-id', clientSecret: 'sandbox-secret' });
  });

  it('falls back to base credentials when EBAY_SANDBOX is false but prod vars are unset', () => {
    const creds = getEbayUserFlowCredentials({
      EBAY_SANDBOX: false,
      EBAY_CLIENT_ID: 'sandbox-id',
      EBAY_CLIENT_SECRET: 'sandbox-secret',
      EBAY_PROD_CLIENT_ID: undefined,
      EBAY_PROD_CLIENT_SECRET: undefined,
    });
    expect(creds).toEqual({ clientId: 'sandbox-id', clientSecret: 'sandbox-secret' });
  });

  it('returns undefined values when no credentials are configured', () => {
    const creds = getEbayUserFlowCredentials({
      EBAY_SANDBOX: false,
      EBAY_CLIENT_ID: undefined,
      EBAY_CLIENT_SECRET: undefined,
      EBAY_PROD_CLIENT_ID: undefined,
      EBAY_PROD_CLIENT_SECRET: undefined,
    });
    expect(creds).toEqual({ clientId: undefined, clientSecret: undefined });
  });
});
