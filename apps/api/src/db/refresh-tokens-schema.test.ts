import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { refreshTokens, users } from './schema.js';

describe('refreshTokens schema', () => {
  it('users table no longer carries the legacy single-hash column', () => {
    expect(getTableColumns(users)).not.toHaveProperty('refreshTokenHash');
  });

  it('defines a per-session table with hash lookup and expiry', () => {
    const cols = getTableColumns(refreshTokens);

    expect(cols.id).toBeDefined();
    expect(cols.userId.notNull).toBe(true);
    expect(cols.tokenHash.notNull).toBe(true);
    expect(cols.tokenHash.isUnique).toBe(true);
    expect(cols.expiresAt.notNull).toBe(true);
    expect(cols.createdAt.notNull).toBe(true);
    expect(cols.lastUsedAt.notNull).toBe(false);
  });
});
