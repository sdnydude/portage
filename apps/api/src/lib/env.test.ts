import { envSchema } from './env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'y'.repeat(64),
};

describe('envSchema', () => {
  it('rejects a production environment without CF_ACCESS_AUD', () => {
    const result = envSchema.safeParse({ ...baseEnv, NODE_ENV: 'production' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.flatten().fieldErrors)).toContain('CF_ACCESS_AUD');
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

  it('rejects a LANGFUSE_SAMPLE_RATE outside 0..1', () => {
    expect(envSchema.safeParse({ ...baseEnv, LANGFUSE_SAMPLE_RATE: '1.5' }).success).toBe(false);
    const ok = envSchema.safeParse({ ...baseEnv, LANGFUSE_SAMPLE_RATE: '0.25' });
    expect(ok.success && ok.data.LANGFUSE_SAMPLE_RATE).toBe(0.25);
  });
});
