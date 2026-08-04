import { validateBestOfferThresholds, healBestOfferFromLive } from './best-offer.js';

describe('validateBestOfferThresholds', () => {
  it('rejects an auto-accept at or above the price, naming both numbers', () => {
    const r = validateBestOfferThresholds(199, { bestOfferAutoAcceptPrice: 209 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/209.*199|199.*209/);
  });

  it('rejects a minimum offer at or above the price (eBay 22003 class)', () => {
    const r = validateBestOfferThresholds(199, { minimumBestOfferPrice: 199 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/199/);
  });

  it('rejects non-positive thresholds — a 0/negative value would pass pre-flight then be silently dropped by the builder (CodeRabbit)', () => {
    expect(validateBestOfferThresholds(199, { bestOfferAutoAcceptPrice: 0 }).ok).toBe(false);
    expect(validateBestOfferThresholds(199, { minimumBestOfferPrice: -5 }).ok).toBe(false);
  });

  it('passes when both thresholds sit below the price (or are absent)', () => {
    expect(validateBestOfferThresholds(199, { bestOfferAutoAcceptPrice: 189, minimumBestOfferPrice: 150 }).ok).toBe(true);
    expect(validateBestOfferThresholds(199, {}).ok).toBe(true);
  });

  it('rejects auto-accept at or below the minimum offer (eBay 23005 class), naming both numbers', () => {
    // Live failure 2026-08-04: accept $135 under minimum $144 passed pre-flight,
    // died at eBay with 23005 "Auto Accept price must be higher than Auto Decline price".
    const swapped = validateBestOfferThresholds(149, { bestOfferAutoAcceptPrice: 135, minimumBestOfferPrice: 144 });
    expect(swapped.ok).toBe(false);
    if (!swapped.ok) expect(swapped.message).toMatch(/135.*144|144.*135/);
    const equal = validateBestOfferThresholds(149, { bestOfferAutoAcceptPrice: 140, minimumBestOfferPrice: 140 });
    expect(equal.ok).toBe(false);
  });
});

describe('healBestOfferFromLive', () => {
  it('adopts the live eBay Best Offer state over the stored copy — eBay is the source of truth', async () => {
    const adapter = {
      getEbayItemVerification: vi.fn().mockResolvedValue({
        found: true, bestOfferEnabled: true, bestOfferAutoAcceptPrice: 180, minimumBestOfferPrice: 150,
      }),
    };
    const stored = { categoryId: '175669', bestOfferEnabled: true, bestOfferAutoAcceptPrice: 269, minimumBestOfferPrice: 249 };

    const r = await healBestOfferFromLive(adapter as never, '307100024169', stored);

    expect(r.healed).toBe(true);
    expect(r.specific.bestOfferAutoAcceptPrice).toBe(180);
    expect(r.specific.minimumBestOfferPrice).toBe(150);
    expect(r.specific.categoryId).toBe('175669'); // untouched siblings survive
  });

  it('never deletes local config when the live Best Offer block did not positively parse (audit #2 — unverified GetItem shape)', async () => {
    const adapter = {
      getEbayItemVerification: vi.fn().mockResolvedValue({
        found: true, bestOfferEnabled: null, bestOfferAutoAcceptPrice: null, minimumBestOfferPrice: null,
      }),
    };
    const stored = { bestOfferEnabled: true, bestOfferAutoAcceptPrice: 269, minimumBestOfferPrice: 249 };

    const r = await healBestOfferFromLive(adapter as never, '307100024169', stored);

    expect(r.healed).toBe(false);
    expect(r.specific).toEqual(stored); // a parse miss must NEVER strip seller config
  });
});
