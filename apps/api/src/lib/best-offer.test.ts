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

  it('passes when both thresholds sit below the price (or are absent)', () => {
    expect(validateBestOfferThresholds(199, { bestOfferAutoAcceptPrice: 189, minimumBestOfferPrice: 150 }).ok).toBe(true);
    expect(validateBestOfferThresholds(199, {}).ok).toBe(true);
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
});
