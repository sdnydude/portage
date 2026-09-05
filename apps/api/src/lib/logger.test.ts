import { describe, it, expect } from 'vitest';
import { pino } from 'pino';
import { loggerOptions } from './logger.js';

/** Serialize one log call through a pino instance built from the app's
 *  logger options and return the parsed JSON line. */
function logLine(payload: Record<string, unknown>): Record<string, unknown> {
  let out = '';
  const stream = { write: (s: string) => { out += s; } };
  const log = pino({ ...loggerOptions, level: 'info' }, stream);
  log.info(payload, 'test line');
  return JSON.parse(out) as Record<string, unknown>;
}

describe('loggerOptions redact', () => {
  it('redacts req.headers.authorization', () => {
    const line = logLine({ req: { headers: { authorization: 'Bearer sekret.token.value' } } });
    expect((line.req as { headers: { authorization: string } }).headers.authorization).toBe('[REDACTED]');
  });

  it('redacts req.headers.cookie', () => {
    const line = logLine({ req: { headers: { cookie: 'CF_Authorization=abc; session=def' } } });
    expect((line.req as { headers: { cookie: string } }).headers.cookie).toBe('[REDACTED]');
  });

  it('redacts the cf-access-jwt-assertion header', () => {
    const line = logLine({ req: { headers: { 'cf-access-jwt-assertion': 'eyJhbGciOi.eyJzdWIi.sig' } } });
    expect((line.req as { headers: Record<string, string> }).headers['cf-access-jwt-assertion']).toBe('[REDACTED]');
  });

  it('redacts the cf-access-authenticated-user-email header', () => {
    const line = logLine({ req: { headers: { 'cf-access-authenticated-user-email': 'swebber@fafstudios.com' } } });
    expect((line.req as { headers: Record<string, string> }).headers['cf-access-authenticated-user-email']).toBe('[REDACTED]');
  });

  it('redacts res.headers["set-cookie"]', () => {
    const line = logLine({ res: { headers: { 'set-cookie': 'portage_token=eyJx.y.z; HttpOnly' } } });
    expect((line.res as { headers: Record<string, string> }).headers['set-cookie']).toBe('[REDACTED]');
  });
});
