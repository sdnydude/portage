import { describe, it, expect } from 'vitest';
import { items, listings, sellerProfiles } from './schema.js';

// In a schema-push workflow with no migration files, these shape assertions are
// the only guard against accidental column drift. They cover the four columns
// added for eBay listing publish hardening.
describe('schema — eBay listing hardening columns', () => {
  it('adds quantity, ebaySku, and ebayPublishMode columns', () => {
    // items.quantity — sellable quantity, NOT NULL, defaults to 1
    expect(items.quantity).toBeDefined();
    expect(items.quantity.notNull).toBe(true);

    // listings.ebaySku — nullable; stores the reusable eBay inventory SKU
    expect(listings.ebaySku).toBeDefined();
    expect(listings.ebaySku.notNull).toBe(false);

    // seller_profiles.ebayPublishMode — global draft/live default, NOT NULL, defaults to 'live'
    expect(sellerProfiles.ebayPublishMode).toBeDefined();
    expect(sellerProfiles.ebayPublishMode.notNull).toBe(true);
  });

  it('adds the listings.ebayOfferId column for offer reuse on re-publish', () => {
    // Nullable — a live publish overwrites marketplaceListingId with the eBay
    // listingId, so the offerId is stored separately to re-sync/re-publish.
    expect(listings.ebayOfferId).toBeDefined();
    expect(listings.ebayOfferId.notNull).toBe(false);
  });
});
