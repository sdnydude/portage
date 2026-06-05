import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('CORS EXTRA_CORS_ORIGINS', () => {
  const original = process.env.EXTRA_CORS_ORIGINS;
  afterEach(() => {
    if (original === undefined) delete process.env.EXTRA_CORS_ORIGINS;
    else process.env.EXTRA_CORS_ORIGINS = original;
  });

  it('reflects an origin listed in EXTRA_CORS_ORIGINS', async () => {
    process.env.EXTRA_CORS_ORIGINS = 'http://10.0.0.251:3998';
    const app = createApp();
    const res = await request(app).get('/health').set('Origin', 'http://10.0.0.251:3998');
    expect(res.headers['access-control-allow-origin']).toBe('http://10.0.0.251:3998');
  });
});
