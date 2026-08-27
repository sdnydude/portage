import { z } from 'zod';
import { validateCfAccessAud } from './cf-access-config.js';
import { missingProdEnv } from './prod-env-guard.js';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * eBay guide: the deletion endpoint "should use the 'https' protocol, and it
 * should not contain an internal IP address or 'localhost'". Only IP LITERALS
 * are range-checked — hostnames are never prefix-matched (a public host like
 * fdx.example.com must not brick boot).
 */
export function isPublicHttpsUrl(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol !== 'https:') return false;
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (isIPv4(host)) {
      return !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host);
    }
    if (isIPv6(host)) {
      return !(host === '::1' || host === '::' || /^(fc|fd|fe[89ab])/.test(host));
    }
    return true;
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(8016),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(64),
  ANTHROPIC_API_KEY: z.string().optional(),
  VISION_PROVIDERS: z.string().default('anthropic'),
  CHAT_PROVIDERS: z.string().default('anthropic'),
  LOCAL_LLM_BASE_URL: z.string().optional(),
  LOCAL_LLM_API_KEY: z.string().default('ollama'),
  LOCAL_LLM_VISION_MODEL: z.string().default('qwen3-vl'),
  LOCAL_LLM_CHAT_MODEL: z.string().default('qwen3:8b'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_VISION_MODEL: z.string().default('gemini-2.5-pro'),
  GEMINI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().default('gpt-4.1'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  HUGGINGFACE_API_KEY: z.string().optional(),
  HUGGINGFACE_BASE_URL: z.string().default('https://router.huggingface.co/v1'),
  HUGGINGFACE_VISION_MODEL: z.string().default('Qwen/Qwen2.5-VL-7B-Instruct'),
  HUGGINGFACE_CHAT_MODEL: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_PROD_CLIENT_ID: z.string().optional(),
  EBAY_PROD_CLIENT_SECRET: z.string().optional(),
  EBAY_REDIRECT_URI: z.string().optional(),
  // NOTE: z.coerce.boolean() treats any non-empty string as true (Boolean('false') === true),
  // so "false" would wrongly enable sandbox. Parse the string explicitly instead.
  EBAY_SANDBOX: z.string().default('true').transform((v) => v.toLowerCase() !== 'false'),
  REVERB_API_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_CREDITS: z.string().optional(),
  // eBay Marketplace Account Deletion endpoint (public, signature-verified).
  // TOKEN: 32-80 chars [A-Za-z0-9_-] per eBay; URL: the EXACT string registered
  // in the eBay developer portal — both feed the challenge-response hash.
  EBAY_DELETION_VERIFICATION_TOKEN: z.string().regex(/^[A-Za-z0-9_-]{32,80}$/, 'must be 32-80 chars of [A-Za-z0-9_-] (eBay verification-token rule)').optional(),
  // eBay guide: "should use the 'https' protocol, and it should not contain an
  // internal IP address or 'localhost'". Public hostname only.
  EBAY_DELETION_ENDPOINT_URL: z.url().refine(isPublicHttpsUrl,
    'must be a public https URL (no localhost / internal IP) — eBay endpoint rule').optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().optional(),
  REMBG_URL: z.string().default('http://localhost:7000'),
  METRICS_SECRET: z.string().optional(),
  // Beta invite emails (Resend). FROM must be on a verified Resend domain.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('Portage Beta <beta@beta.digitalharmonyai.com>'),
  APP_URL: z.string().default('https://portage.digitalharmonyai.com'),
  // User identity for CF Access service-token requests (e2e) — service tokens
  // carry a common_name instead of an email. BOTH values must be set and the
  // token's common_name must match, or the service token is rejected.
  CF_ACCESS_SERVICE_EMAIL: z.string().optional(),
  CF_ACCESS_SERVICE_COMMON_NAME: z.string().optional(),
  // Audience tag of the Cloudflare Access application protecting Portage.
  CF_ACCESS_AUD: z.string().optional(),
  CF_ACCESS_TEAM_DOMAIN: z.string().default('digitalharmonyai'),
  // Cloudflare API access for the admin allowlist manager (Access:Edit scope).
  CF_API_TOKEN: z.string().optional(),
  CF_ACCOUNT_ID: z.string().optional(),
  // Access application IDs whose allow policy carries the email allowlist
  // (comma-separated: web app + API hostname app).
  CF_ACCESS_APP_IDS: z.string().optional(),
  // Dev-only identity when no Cloudflare edge is in front (LAN dev). Read
  // only when NODE_ENV=development, so it can never bypass auth elsewhere.
  CF_ACCESS_DEV_EMAIL: z.string().optional(),
  // Langfuse LLM observability. Tracing stays off unless BOTH keys are present,
  // so dev boxes, CI, and the test suite emit nothing without opting in.
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().default('https://us.cloud.langfuse.com'),
  // Fraction of traces exported, 0..1. Full sampling until volume justifies less.
  LANGFUSE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
}).superRefine((value, ctx) => {
  // /auth/session is dead without the right audiences — surface the
  // misconfiguration at startup instead of 401-ing every login in production.
  // Portage needs BOTH Access apps' tags (web + API, comma-separated): the
  // 2026-07-28 outage was a Doppler resync leaving a single aud, so browser
  // assertions (web-app aud) failed verify with "unexpected aud".
  if (value.NODE_ENV === 'production') {
    try {
      validateCfAccessAud(value.CF_ACCESS_AUD, value.NODE_ENV);
    } catch (err) {
      ctx.addIssue({
        code: 'custom',
        path: ['CF_ACCESS_AUD'],
        message: (err as Error).message,
      });
    }
  }
  // Statically-required production keys — one issue per missing key so a
  // single failed boot names the whole gap (see prod-env-guard.ts).
  for (const key of missingProdEnv(value, value.NODE_ENV)) {
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message: `${key} is required in production (boot guard). Check Doppler and resync the env file.`,
    });
  }
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;
  dotenv.config({ path: resolve(process.cwd(), '.env') });
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(z.flattenError(result.error).fieldErrors);
    process.exit(1);
  }
  _env = result.data as Env;
  return _env;
}

export function env(): Env {
  if (!_env) throw new Error('Call loadEnv() before accessing env()');
  return _env;
}

export function resetEnv(): void {
  _env = null;
}
