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
});
