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

const { mockEbayUpdateListing, mockReverbUpdateListing } = vi.hoisted(() => ({
  mockEbayUpdateListing: vi.fn(), mockReverbUpdateListing: vi.fn(),
}));
vi.mock('../marketplace/ebay-adapter.js', () => {
  const EbayAdapter = vi.fn(() => ({ updateListing: mockEbayUpdateListing }));
  (EbayAdapter as unknown as Record<string, unknown>).getCategorySuggestion = vi.fn();
  return {
    EbayAdapter,
    resolveEbayCategoryId: vi.fn(async (specific: Record<string, unknown> | undefined) => ({
      categoryId: (specific?.categoryId as string) ?? null, categoryName: null, newlyResolved: false,
    })),
  };
});
vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: vi.fn(() => ({ updateListing: mockReverbUpdateListing })),
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
});
