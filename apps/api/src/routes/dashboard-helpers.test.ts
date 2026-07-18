import { describe, it, expect } from 'vitest';
import { mapRecentListing, type RecentListingRow } from './dashboard-helpers.js';

const base: RecentListingRow = {
  id: 'l1',
  itemId: 'i1',
  marketplace: 'ebay',
  status: 'active',
  price: 42,
  currency: 'USD',
  createdAt: '2026-06-09T00:00:00Z',
  publishedAt: null,
  itemTitle: 'Widget',
  itemPhoto: null,
  aiConfidence: 0.92,
};

describe('mapRecentListing', () => {
  it('passes the AI confidence through unchanged', () => {
    expect(mapRecentListing(base).confidence).toBe(0.92);
  });

  it('selects the flagged primary photo, falls back to first, else null', () => {
    expect(
      mapRecentListing({ ...base, itemPhoto: [{ url: 'a.jpg' }, { url: 'b.jpg', isPrimary: true }] }).itemPhotoUrl,
    ).toBe('b.jpg');
    expect(
      mapRecentListing({ ...base, itemPhoto: [{ url: 'a.jpg' }, { url: 'b.jpg' }] }).itemPhotoUrl,
    ).toBe('a.jpg');
    expect(mapRecentListing({ ...base, itemPhoto: [] }).itemPhotoUrl).toBeNull();
    expect(mapRecentListing({ ...base, itemPhoto: null }).itemPhotoUrl).toBeNull();
  });
});
