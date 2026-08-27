import { z } from 'zod';
import { envSchema } from './env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'y'.repeat(64),
};

// Fully-populated production env: every key the prod boot guard requires.
const prodEnv = {
  ...baseEnv,
  NODE_ENV: 'production',
  CF_ACCESS_AUD: 'a'.repeat(64) + ',' + 'b'.repeat(64),
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'bucket',
  R2_PUBLIC_URL: 'https://r2.example.com',
  EBAY_CLIENT_ID: 'ebay-id',
  EBAY_CLIENT_SECRET: 'ebay-secret',
  STRIPE_SECRET_KEY: 'sk_live_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_PRICE_MONTHLY: 'price_m',
  STRIPE_PRICE_ANNUAL: 'price_a',
  STRIPE_PRICE_CREDITS: 'price_c',
  EBAY_DELETION_VERIFICATION_TOKEN: 'v'.repeat(40),
  EBAY_DELETION_ENDPOINT_URL: 'https://portage-api.digitalharmonyai.com/marketplace/ebay/account-deletion',
};

describe('envSchema', () => {
  it('rejects a production environment without CF_ACCESS_AUD', () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: 'production' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(z.flattenError(result.error).fieldErrors)).toContain('CF_ACCESS_AUD');
    }
  });

  it('rejects a production CF_ACCESS_AUD with only ONE audience tag (2026-07-28 outage class)', () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: 'production', CF_ACCESS_AUD: 'a'.repeat(64) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(z.flattenError(result.error).fieldErrors)).toContain('CF_ACCESS_AUD');
    }
  });

  it('defaults LANGFUSE_BASE_URL to the US cloud region', () => {
    const result = envSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LANGFUSE_BASE_URL).toBe('https://us.cloud.langfuse.com');
    }
  });

  it('carries the Langfuse keys through as optional', () => {
    const result = envSchema.safeParse({ ...baseEnv, LANGFUSE_PUBLIC_KEY: 'pk-lf-1', LANGFUSE_SECRET_KEY: 'sk-lf-1' });
    expect(result.success && result.data.LANGFUSE_PUBLIC_KEY).toBe('pk-lf-1');
    expect(result.success && result.data.LANGFUSE_SECRET_KEY).toBe('sk-lf-1');
    expect(envSchema.safeParse(baseEnv).success).toBe(true);
  });

  it('rejects a production environment missing EBAY_DELETION_VERIFICATION_TOKEN by name', () => {
    const result = envSchema.safeParse({ ...prodEnv, EBAY_DELETION_VERIFICATION_TOKEN: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(z.flattenError(result.error).fieldErrors)).toContain('EBAY_DELETION_VERIFICATION_TOKEN');
    }
  });

  it('names EVERY missing production key in one aggregate error, not just the first', () => {
    const result = envSchema.safeParse({
      ...prodEnv,
      EBAY_DELETION_VERIFICATION_TOKEN: undefined,
      EBAY_DELETION_ENDPOINT_URL: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = Object.keys(z.flattenError(result.error).fieldErrors);
      expect(keys).toEqual(expect.arrayContaining(['EBAY_DELETION_VERIFICATION_TOKEN', 'EBAY_DELETION_ENDPOINT_URL']));
    }
  });

  it('does not require the production-only keys outside production', () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: 'development' });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated production environment', () => {
    const result = envSchema.safeParse(prodEnv);
    expect(result.success).toBe(true);
  });

  it('rejects an EBAY_DELETION_VERIFICATION_TOKEN outside eBay\'s 32-80 char [A-Za-z0-9_-] rule', () => {
    const short = envSchema.safeParse({ ...prodEnv, EBAY_DELETION_VERIFICATION_TOKEN: 'short' });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(Object.keys(z.flattenError(short.error).fieldErrors)).toContain('EBAY_DELETION_VERIFICATION_TOKEN');
    }
    const badChars = envSchema.safeParse({ ...prodEnv, EBAY_DELETION_VERIFICATION_TOKEN: 'x'.repeat(31) + '!' });
    expect(badChars.success).toBe(false);
  });

  it('rejects an EBAY_DELETION_ENDPOINT_URL that is not https or points at localhost/an internal address (eBay rule)', () => {
    for (const bad of ['http://portage-api.digitalharmonyai.com/x', 'https://localhost:8016/x', 'https://10.0.0.251:8016/x', 'https://127.0.0.1/x', 'not a url']) {
      const r = envSchema.safeParse({ ...prodEnv, EBAY_DELETION_ENDPOINT_URL: bad });
      expect(r.success, bad).toBe(false);
      if (!r.success) expect(Object.keys(z.flattenError(r.error).fieldErrors)).toContain('EBAY_DELETION_ENDPOINT_URL');
    }
    // Public hostnames that merely START with an IPv6-prefix-looking string are fine.
    for (const good of ['https://fdx.example.com/x', 'https://fe80cdn.io/x', 'https://fcshop.com/x', 'https://portage-api.digitalharmonyai.com/marketplace/ebay/account-deletion']) {
      expect(envSchema.safeParse({ ...prodEnv, EBAY_DELETION_ENDPOINT_URL: good }).success, good).toBe(true);
    }
    for (const badV6 of ['https://[::1]/x', 'https://[fe80::1]/x', 'https://[fd00::1]/x']) {
      expect(envSchema.safeParse({ ...prodEnv, EBAY_DELETION_ENDPOINT_URL: badV6 }).success, badV6).toBe(false);
    }
  });

  it('requires the R2 / eBay / Stripe keys in production, naming each missing one', () => {
    const result = envSchema.safeParse({
      ...prodEnv,
      R2_ACCOUNT_ID: undefined,
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET_NAME: undefined,
      R2_PUBLIC_URL: undefined,
      EBAY_CLIENT_ID: undefined,
      EBAY_CLIENT_SECRET: undefined,
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(z.flattenError(result.error).fieldErrors).sort()).toEqual([
        'EBAY_CLIENT_ID|EBAY_PROD_CLIENT_ID', 'EBAY_CLIENT_SECRET|EBAY_PROD_CLIENT_SECRET',
        'R2_ACCESS_KEY_ID', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'R2_SECRET_ACCESS_KEY',
        'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
      ]);
    }
  });

  it('accepts eBay credentials from EITHER the base or the PROD keyset (runtime falls back EBAY_PROD_* → EBAY_*), and requires the Stripe price ids', () => {
    // prod keyset only — how a prod Doppler config may legitimately look
    const prodOnly = envSchema.safeParse({ ...prodEnv, EBAY_CLIENT_ID: undefined, EBAY_CLIENT_SECRET: undefined, EBAY_PROD_CLIENT_ID: 'p-id', EBAY_PROD_CLIENT_SECRET: 'p-secret' });
    expect(prodOnly.success).toBe(true);
    // neither keyset → named as a group
    const neither = envSchema.safeParse({ ...prodEnv, EBAY_CLIENT_ID: undefined, EBAY_CLIENT_SECRET: undefined });
    expect(neither.success).toBe(false);
    if (!neither.success) {
      const keys = Object.keys(z.flattenError(neither.error).fieldErrors);
      expect(keys).toEqual(expect.arrayContaining(['EBAY_CLIENT_ID|EBAY_PROD_CLIENT_ID', 'EBAY_CLIENT_SECRET|EBAY_PROD_CLIENT_SECRET']));
    }
    // checkout dies at request time without price ids — same class the guard exists for
    const noPrices = envSchema.safeParse({ ...prodEnv, STRIPE_PRICE_MONTHLY: undefined, STRIPE_PRICE_ANNUAL: '', STRIPE_PRICE_CREDITS: undefined });
    expect(noPrices.success).toBe(false);
    if (!noPrices.success) {
      expect(Object.keys(z.flattenError(noPrices.error).fieldErrors)).toEqual(expect.arrayContaining(['STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_ANNUAL', 'STRIPE_PRICE_CREDITS']));
    }
  });

  it('rejects a LANGFUSE_SAMPLE_RATE outside 0..1', () => {
    expect(envSchema.safeParse({ ...baseEnv, LANGFUSE_SAMPLE_RATE: '1.5' }).success).toBe(false);
    const ok = envSchema.safeParse({ ...baseEnv, LANGFUSE_SAMPLE_RATE: '0.25' });
    expect(ok.success && ok.data.LANGFUSE_SAMPLE_RATE).toBe(0.25);
  });

  it('reports failures as a { field: [messages] } map — the shape loadEnv() prints at boot (z.flattenError)', () => {
    const bad = envSchema.safeParse({ ...baseEnv, LANGFUSE_SAMPLE_RATE: '1.5' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const fieldErrors = z.flattenError(bad.error).fieldErrors as Record<string, string[] | undefined>;
      expect(Array.isArray(fieldErrors.LANGFUSE_SAMPLE_RATE)).toBe(true);
      expect(typeof fieldErrors.LANGFUSE_SAMPLE_RATE?.[0]).toBe('string');
    }
  });
});
