import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(8016),
  DATABASE_URL: z.string().url(),
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
  ETSY_API_KEY: z.string().optional(),
  ETSY_SHARED_SECRET: z.string().optional(),
  ETSY_REDIRECT_URI: z.string().optional(),
  EASYPOST_API_KEY: z.string().optional(),
  REVERB_API_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_CREDITS: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().optional(),
  REMBG_URL: z.string().default('http://localhost:7000'),
  METRICS_SECRET: z.string().optional(),
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
    console.error(result.error.flatten().fieldErrors);
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
