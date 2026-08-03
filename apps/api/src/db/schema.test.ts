import { describe, it, expect } from 'vitest';
import { items, listings, sellerProfiles, marketplaceSyncLog } from './schema.js';

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

// eBay Calculated shipping requires a package weight + dimensions (error 25020).
// These columns store the seller-confirmed or AI-estimated package metrics,
// normalized to ounces + inches; converted to the eBay packageWeightAndSize
// shape at publish. All nullable (existing rows) except the estimate flag.
describe('schema — eBay package weight & dimension columns', () => {
  it('adds nullable weightOz + length/width/height_in + ebayPackageType, and a weightEstimated flag', () => {
    expect(items.weightOz).toBeDefined();
    expect(items.weightOz.notNull).toBe(false);
    expect(items.lengthIn).toBeDefined();
    expect(items.lengthIn.notNull).toBe(false);
    expect(items.widthIn).toBeDefined();
    expect(items.widthIn.notNull).toBe(false);
    expect(items.heightIn).toBeDefined();
    expect(items.heightIn.notNull).toBe(false);
    // ebayPackageType holds an eBay enum string (MAILING_BOX/LETTER/...) —
    // deliberately a varchar, NOT the box/envelope/poly_mailer packageTypeEnum.
    expect(items.ebayPackageType).toBeDefined();
    expect(items.ebayPackageType.notNull).toBe(false);
    // weightEstimated: true when AI-populated, flips false on seller edit.
    expect(items.weightEstimated).toBeDefined();
    expect(items.weightEstimated.notNull).toBe(true);
  });
});

// P1 of the marketplace sync refactor (plan 2026-08-02): the durable sync log.
// Every marketplace sync attempt writes a row here — the transient
// syncWarnings/warning response fields stop being the only failure record.
describe('schema — marketplace_sync_log (sync refactor P1)', () => {
  it('defines marketplaceSyncLog with required attribution, status, trigger, and nullable diagnostics', () => {
    expect(marketplaceSyncLog.userId.notNull).toBe(true);
    expect(marketplaceSyncLog.marketplace.notNull).toBe(true);
    expect(marketplaceSyncLog.status.notNull).toBe(true);      // 'success' | 'failure'
    expect(marketplaceSyncLog.trigger.notNull).toBe(true);     // item_edit | listing_edit | photo | publish | mass_sync
    // Diagnostics are failure-shaped, so nullable: message (marketplace error
    // string), errors (Reverb reverb_response.errors verbatim), durationMs.
    expect(marketplaceSyncLog.itemId.notNull).toBe(false);
    expect(marketplaceSyncLog.listingId.notNull).toBe(false);
    expect(marketplaceSyncLog.message.notNull).toBe(false);
    expect(marketplaceSyncLog.errors.notNull).toBe(false);
    expect(marketplaceSyncLog.durationMs.notNull).toBe(false);
    expect(marketplaceSyncLog.createdAt.notNull).toBe(true);
  });
});
