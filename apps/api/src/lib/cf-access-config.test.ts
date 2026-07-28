import { describe, it, expect } from 'vitest';
import { validateCfAccessAud } from './cf-access-config.js';

// 2026-07-28 login outage: a Doppler resync dropped the web-app aud from
// CF_ACCESS_AUD (one entry instead of two) and every CF exchange 401ed with
// "unexpected aud" — a silent login death. This guard turns that env-drift
// class into a loud boot failure in production.
describe('validateCfAccessAud', () => {
  it('throws in production when CF_ACCESS_AUD has fewer than 2 audience tags (the outage class)', () => {
    const single = 'a'.repeat(64);
    expect(() => validateCfAccessAud(single, 'production')).toThrow(/CF_ACCESS_AUD/);
    expect(() => validateCfAccessAud(undefined, 'production')).toThrow(/CF_ACCESS_AUD/);
  });

  it('accepts two comma-separated tags in production; dev/test run without a CF edge and are exempt', () => {
    const both = `${'a'.repeat(64)},${'b'.repeat(64)}`;
    expect(() => validateCfAccessAud(both, 'production')).not.toThrow();
    expect(() => validateCfAccessAud(` ${'a'.repeat(64)} , ${'b'.repeat(64)} `, 'production')).not.toThrow();
    expect(() => validateCfAccessAud(undefined, 'development')).not.toThrow();
    expect(() => validateCfAccessAud('single', 'test')).not.toThrow();
  });
});
