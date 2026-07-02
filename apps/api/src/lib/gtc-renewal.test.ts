import { describe, it, expect } from 'vitest';
import { nextRenewalDate, shouldAutoEnd } from './gtc-renewal.js';

describe('nextRenewalDate', () => {
  it('returns the next monthly anniversary after now', () => {
    const published = new Date('2026-07-05T14:00:00Z');
    const now = new Date('2026-07-20T00:00:00Z');
    expect(nextRenewalDate(published, now).toISOString()).toBe('2026-08-05T14:00:00.000Z');
  });

  it('skips past anniversaries that already elapsed', () => {
    const published = new Date('2026-01-10T09:00:00Z');
    const now = new Date('2026-06-15T00:00:00Z');
    expect(nextRenewalDate(published, now).toISOString()).toBe('2026-07-10T09:00:00.000Z');
  });

  it('clamps a day-31 publish to the last day of a 30-day month', () => {
    const published = new Date('2026-03-31T12:00:00Z');
    const now = new Date('2026-04-01T00:00:00Z');
    expect(nextRenewalDate(published, now).toISOString()).toBe('2026-04-30T12:00:00.000Z');
  });

  it('returns to the true publish day after a clamped month', () => {
    const published = new Date('2026-01-31T12:00:00Z');
    const now = new Date('2026-03-01T00:00:00Z');
    expect(nextRenewalDate(published, now).toISOString()).toBe('2026-03-31T12:00:00.000Z');
  });

  it('treats an anniversary exactly at now as elapsed', () => {
    const published = new Date('2026-06-05T14:00:00Z');
    const now = new Date('2026-07-05T14:00:00Z');
    expect(nextRenewalDate(published, now).toISOString()).toBe('2026-08-05T14:00:00.000Z');
  });
});

describe('shouldAutoEnd', () => {
  it('is true 2 days before the renewal anniversary and false 3 days before', () => {
    const published = new Date('2026-07-05T14:00:00Z');
    expect(shouldAutoEnd(published, new Date('2026-08-03T14:00:00Z'))).toBe(true);
    expect(shouldAutoEnd(published, new Date('2026-08-02T13:00:00Z'))).toBe(false);
  });

  it('is false right after publish and respects a custom window', () => {
    const published = new Date('2026-07-05T14:00:00Z');
    expect(shouldAutoEnd(published, new Date('2026-07-06T14:00:00Z'))).toBe(false);
    expect(shouldAutoEnd(published, new Date('2026-07-31T14:00:00Z'), 5)).toBe(true);
    expect(shouldAutoEnd(published, new Date('2026-07-31T14:00:00Z'), 2)).toBe(false);
  });
});
