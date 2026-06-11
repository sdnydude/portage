import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { refreshTokens } from './schema.js';

describe('refreshTokens schema', () => {
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
