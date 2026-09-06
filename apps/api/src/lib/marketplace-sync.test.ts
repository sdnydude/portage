import { db } from '../db/index.js';
import { syncItemListingRow } from './marketplace-sync.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const { mockEbayUpdateListing, mockReverbUpdateListing, mockGetEbayItemVerification } = vi.hoisted(() => ({
  mockEbayUpdateListing: vi.fn(), mockReverbUpdateListing: vi.fn(), mockGetEbayItemVerification: vi.fn(),
}));
vi.mock('../marketplace/ebay-adapter.js', () => {
  const EbayAdapter = vi.fn(function () { return ({ updateListing: mockEbayUpdateListing, getEbayItemVerification: mockGetEbayItemVerification }); });
  (EbayAdapter as unknown as Record<string, unknown>).getCategorySuggestion = vi.fn();
  return {
    EbayAdapter,
    resolveEbayCategoryId: vi.fn(async (specific: Record<string, unknown> | undefined) => ({
      categoryId: (specific?.categoryId as string) ?? null, categoryName: null, newlyResolved: false,
    })),
  };
});
vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: vi.fn(function () { return ({ updateListing: mockReverbUpdateListing }); }),
}));

function mockSelectReturnOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

const ITEM = {
  id: 'item-1',
  title: 'Fender Stratocaster',
  description: 'Great strat',
  category: 'guitars',
  condition: 'good',
  conditionNotes: '',
  brand: 'Fender',
  model: 'Strat',
  price: 1200,
  quantity: 1,
  photos: [{ url: 'https://r2.example/a.jpg' }],
  features: [],
  aspects: null,
  marketplaceData: null,
  weightOz: null, lengthIn: null, widthIn: null, heightIn: null, ebayPackageType: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncItemListingRow', () => {
  it('syncs a Reverb row with enriched specifics and returns adapter warnings', async () => {
    mockSelectReturnOnce([{ userId: 'user-1', reverbOffersEnabled: false, reverbDefaultShipping: null }]); // enrichment profile
    mockSelectReturnOnce([]); // footer read (none)
    mockReverbUpdateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321', status: 'active',
      warning: 'Listing is sold on Reverb — the update was accepted but the listing is no longer for sale',
    });

    const result = await syncItemListingRow('user-1', ITEM as any, {
      id: 'row-1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321',
      ebaySku: null, marketplaceSpecificFields: { conditionUuid: 'cu-1', categoryUuid: 'cat-1' }, currency: 'USD',
    }, { includePhotos: false });

    expect(mockReverbUpdateListing).toHaveBeenCalledTimes(1);
    const [id, input] = mockReverbUpdateListing.mock.calls[0];
    expect(id).toBe('87654321');
    expect(input.title).toBe('Fender Stratocaster');
    expect(input.photos).toBeUndefined(); // includePhotos false
    expect(input.marketplaceSpecific?.offersEnabled).toBe(false); // enrichment applied
    expect(result.warnings.some((w: string) => /sold on Reverb/.test(w))).toBe(true);
  });

  it('appends the seller\'s default listing footer to the Reverb description too (publish parity)', async () => {
    mockSelectReturnOnce([{ userId: 'user-1', reverbOffersEnabled: false, reverbDefaultShipping: null }]); // enrichment profile
    mockSelectReturnOnce([{ footer: 'Smoke-free studio.' }]); // footer read
    mockReverbUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '87654321', status: 'active' });

    await syncItemListingRow('user-1', ITEM as any, {
      id: 'row-1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321',
      ebaySku: null, marketplaceSpecificFields: { conditionUuid: 'cu-1', categoryUuid: 'cat-1' }, currency: 'USD',
    }, { includePhotos: false });

    const [, input] = mockReverbUpdateListing.mock.calls[0];
    expect(input.description).toBe('Great strat\n\nSmoke-free studio.');
  });

  it('surfaces a warning when Reverb enrichment fails instead of reporting a clean success (audit M9)', async () => {
    // Profile read blows up — the sync itself must proceed on stored
    // specifics, but the result may NOT read as a clean success.
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('db timeout')),
        }),
      }),
    } as any);
    mockReverbUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '87654321', status: 'active' });

    const result = await syncItemListingRow('user-1', ITEM as any, {
      id: 'row-1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321',
      ebaySku: null, marketplaceSpecificFields: { conditionUuid: 'cu-1', categoryUuid: 'cat-1' }, currency: 'USD',
    }, { includePhotos: false });

    expect(mockReverbUpdateListing).toHaveBeenCalledTimes(1); // sync still ran
    expect(result.warnings.some((w: string) => /enrichment/i.test(w))).toBe(true);
  });

  it('passes conditionNotes through to the adapter so condition-note edits reach the marketplace', async () => {
    mockSelectReturnOnce([]); // enrichment profile (none)
    mockSelectReturnOnce([]); // footer read (none)
    mockReverbUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '87654321', status: 'active' });

    await syncItemListingRow('user-1', { ...ITEM, conditionNotes: 'small ding on lower bout' } as any, {
      id: 'row-1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321',
      ebaySku: null, marketplaceSpecificFields: { conditionUuid: 'cu-1', categoryUuid: 'cat-1' }, currency: 'USD',
    }, { includePhotos: false });

    const [, input] = mockReverbUpdateListing.mock.calls[0];
    expect(input.conditionNotes).toBe('small ding on lower bout');
  });

  it('skips a parked-etsy row with a warning instead of falling through to the Reverb adapter', async () => {
    const result = await syncItemListingRow('user-1', ITEM as any, {
      id: 'row-etsy', marketplace: 'etsy', status: 'active', marketplaceListingId: 'etsy-1',
      ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD',
    }, { includePhotos: false });

    expect(mockReverbUpdateListing).not.toHaveBeenCalled();
    expect(mockEbayUpdateListing).not.toHaveBeenCalled();
    expect(result.warnings.some((w: string) => /etsy.*not supported/i.test(w))).toBe(true);
  });

  it('syncs an eBay row with category self-heal, ship-from fill, aspect + shipping merges, and inline photos', async () => {
    const ebayItem = {
      ...ITEM,
      aspects: { Brand: ['Fender'] },
      marketplaceData: { ebay: { categoryId: '33034', categoryName: 'Electric Guitars' } },
      weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3,
    };
    const { resolveEbayCategoryId } = await import('../marketplace/ebay-adapter.js');
    vi.mocked(resolveEbayCategoryId).mockResolvedValueOnce({ categoryId: '33034', categoryName: 'Electric Guitars', newlyResolved: false } as any);
    mockSelectReturnOnce([{ userId: 'user-1', shipFromAddress: { zip: '12561' } }]); // applyShipFromOrigin profile
    mockSelectReturnOnce([]); // footer read (none)
    mockEbayUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '307000000001', status: 'active' });

    await syncItemListingRow('user-1', ebayItem as any, {
      id: 'row-2', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001',
      ebaySku: 'PRT-X', marketplaceSpecificFields: {}, currency: 'USD',
    }, { includePhotos: false });

    expect(mockEbayUpdateListing).toHaveBeenCalledTimes(1);
    const [id, input] = mockEbayUpdateListing.mock.calls[0];
    expect(id).toBe('307000000001');
    expect(input.marketplaceSpecific?.categoryId).toBe('33034');            // self-heal
    expect(input.marketplaceSpecific?.originPostalCode).toBe('12561');      // ship-from fill
    expect(input.marketplaceSpecific?.weight).toBeDefined();                // mergeItemShipping (25020 guard)
    expect(input.marketplaceSpecific?.aspects?.Brand).toEqual(['Fender']);  // mergeItemAspects
    expect(input.photos).toEqual([{ url: 'https://r2.example/a.jpg' }]);    // eBay always sends photos inline
  });

  it('appends the seller\'s default listing footer to the eBay description (publish parity — live: an item edit stripped the footer from the Epson listing, 2026-09-06)', async () => {
    mockSelectReturnOnce([]); // applyShipFromOrigin profile (none)
    mockSelectReturnOnce([{ footer: 'Ships within 1 business day from a smoke free studio.' }]); // footer read
    mockEbayUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '307000000001', status: 'active' });

    await syncItemListingRow('user-1', ITEM as any, {
      id: 'row-2', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001',
      ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '33034' }, currency: 'USD',
    }, { includePhotos: false });

    const [, input] = mockEbayUpdateListing.mock.calls[0];
    expect(input.description).toBe('Great strat\n\nShips within 1 business day from a smoke free studio.');
  });

  it('passes conditionNotes to the eBay adapter too (ConditionDescription parity)', async () => {
    mockSelectReturnOnce([]); // applyShipFromOrigin profile (none)
    mockSelectReturnOnce([]); // footer read (none)
    mockEbayUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '307000000001', status: 'active' });

    await syncItemListingRow('user-1', { ...ITEM, conditionNotes: 'pickguard scratch' } as any, {
      id: 'row-2', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001',
      ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '33034' }, currency: 'USD',
    }, { includePhotos: false });

    const [, input] = mockEbayUpdateListing.mock.calls[0];
    expect(input.conditionNotes).toBe('pickguard scratch');
  });
});

describe('syncItemListingRow Best Offer pre-flight (BO-3 parity with the listings PATCH route)', () => {
  const EBAY_ROW = {
    id: 'listing-1', marketplace: 'ebay' as const, status: 'active',
    marketplaceListingId: '307100024169', ebaySku: null, currency: 'USD',
    marketplaceSpecificFields: {
      categoryId: '175669', bestOfferEnabled: true,
      bestOfferAutoAcceptPrice: 240, minimumBestOfferPrice: 220,
    },
  };

  it('heals stale thresholds from the live listing and syncs with the healed values (live failure 2026-08-04: price 149 vs stored 240/220)', async () => {
    mockSelectReturnOnce([]);
    mockSelectReturnOnce([]); // footer read (none)
    mockGetEbayItemVerification.mockResolvedValue({
      found: true, bestOfferEnabled: true, bestOfferAutoAcceptPrice: 140, minimumBestOfferPrice: 120,
    });
    mockEbayUpdateListing.mockResolvedValue({ warning: undefined });
    const { warnings } = await syncItemListingRow('user-1', { ...ITEM, price: 149 }, EBAY_ROW, { includePhotos: true });
    expect(mockEbayUpdateListing).toHaveBeenCalledTimes(1);
    const sent = mockEbayUpdateListing.mock.calls[0][1].marketplaceSpecific as Record<string, unknown>;
    expect(sent.bestOfferAutoAcceptPrice).toBe(140);
    expect(sent.minimumBestOfferPrice).toBe(120);
    expect(warnings.some((w: string) => /refreshed/i.test(w))).toBe(true);
  });

  it('terminal-fails with BEST_OFFER_CONFLICT before any eBay call when the live thresholds still conflict with the price', async () => {
    mockSelectReturnOnce([]);
    mockGetEbayItemVerification.mockResolvedValue({
      found: true, bestOfferEnabled: true, bestOfferAutoAcceptPrice: 240, minimumBestOfferPrice: 220,
    });
    await expect(syncItemListingRow('user-1', { ...ITEM, price: 149 }, EBAY_ROW, { includePhotos: true }))
      .rejects.toMatchObject({ code: 'BEST_OFFER_CONFLICT' });
    expect(mockEbayUpdateListing).not.toHaveBeenCalled();
  });

  it('skips the pre-flight entirely when the row has no Best Offer thresholds', async () => {
    mockSelectReturnOnce([]);
    mockSelectReturnOnce([]); // footer read (none)
    mockEbayUpdateListing.mockResolvedValue({ warning: undefined });
    await syncItemListingRow('user-1', { ...ITEM, price: 149 }, {
      ...EBAY_ROW, marketplaceSpecificFields: { categoryId: '175669' },
    }, { includePhotos: true });
    expect(mockGetEbayItemVerification).not.toHaveBeenCalled();
    expect(mockEbayUpdateListing).toHaveBeenCalledTimes(1);
  });
});
