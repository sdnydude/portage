import { beforeAll, afterEach } from 'vitest';
import { resetEnv, loadEnv } from '../lib/env.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://portage:portage@10.0.0.251:5436/portage_test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-characters';
process.env.ENCRYPTION_KEY = 'test-encryption-key-must-be-at-least-sixty-four-characters-long-here';

beforeAll(() => {
  loadEnv();
});

afterEach(() => {
  resetEnv();
  loadEnv();
});
