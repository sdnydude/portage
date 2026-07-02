import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { sellerProfiles } from './schema.js';

describe('seller_profiles gtcAutoEnd column', () => {
  it('exists as gtc_auto_end, non-null, defaulting to false', () => {
    const cols = getTableColumns(sellerProfiles) as Record<string, { name: string; notNull: boolean; default: unknown }>;
    expect(cols.gtcAutoEnd).toBeDefined();
    expect(cols.gtcAutoEnd.name).toBe('gtc_auto_end');
    expect(cols.gtcAutoEnd.notNull).toBe(true);
    expect(cols.gtcAutoEnd.default).toBe(false);
  });
});
