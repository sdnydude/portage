import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

const { mockReverbCreateListing, mockReverbSearchCategories, ReverbAdapterMock } = vi.hoisted(() => {
  const mockReverbCreateListing = vi.fn();
  const mockReverbSearchCategories = vi.fn();
  return {
    mockReverbCreateListing,
    mockReverbSearchCategories,
    ReverbAdapterMock: vi.fn(() => ({
      createListing: mockReverbCreateListing,
      searchCategories: mockReverbSearchCategories,
    })),
  };
});

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: ReverbAdapterMock,
}));

const ITEM_ID = '00000000-0000-0000-0000-000000000001';
const GEAR_ITEM = {
  id: ITEM_ID,
  userId: 'test-user-id',
  title: 'Fender Stratocaster 1979',
  description: 'Sunburst, all original',
  category: 'guitars',
  condition: 'good',
  brand: 'Fender',
  model: 'Stratocaster',
  features: [],
  photos: [{ url: 'https://portage-images.digitalharmonyai.com/strat.jpg' }],
  quantity: 1,
  marketplaceData: {
    reverb: {
      categoryUuid: 'rev-cat-solidbody',
      categoryName: 'Solid Body',
      conditionUuid: 'rev-cond-excellent',
      conditionName: 'Excellent',
      year: '1979',
      finish: 'Sunburst',
      cachedAt: '2026-07-08T00:00:00.000Z',
    },
  },
};

const PROFILE = {
  userId: 'test-user-id',
  reverbDefaultShipping: { rates: [{ regionCode: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }] },
  reverbOffersEnabled: false,
  defaultListingFooter: null,
};

function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockInsertReturning(rows: unknown[]) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    }),
  } as any);
});

describe('POST /listings — reverb live publish', () => {
  it('constructs the adapter with userId and enriches specifics from cache + profile (profile wins offersEnabled)', async () => {
    mockSelectOnce([GEAR_ITEM]);                       // item lookup
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);                         // enrichment profile lookup
    mockSelectOnce([{ footer: null }]);                // footer lookup
    mockReverbCreateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'reverb',
        price: 2500,
        publishMode: 'live',
        disclaimerAccepted: true,
        marketplaceSpecificFields: { offersEnabled: true },
      });

    expect(res.status).toBe(201);
    expect(ReverbAdapterMock).toHaveBeenCalledWith('test-user-id');
    expect(mockReverbCreateListing).toHaveBeenCalledTimes(1);
    const input = mockReverbCreateListing.mock.calls[0][0];
    expect(input.marketplaceSpecific).toMatchObject({
      categoryUuid: 'rev-cat-solidbody',
      conditionUuid: 'rev-cond-excellent',
      year: '1979',
      finish: 'Sunburst',
      offersEnabled: false, // profile is source of truth — client true must lose
      shippingRates: [{ regionCode: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }],
    });
    expect(mockReverbSearchCategories).not.toHaveBeenCalled();
  });

  it('falls back to a category search when no cache exists, persists the guess, and returns a warning', async () => {
    const bareItem = { ...GEAR_ITEM, marketplaceData: null };
    mockSelectOnce([bareItem]);                        // item lookup
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);                         // enrichment profile lookup
    mockSelectOnce([{ footer: null }]);                // footer lookup
    mockReverbSearchCategories.mockResolvedValueOnce([
      { id: 'rev-cat-guessed', name: 'Electric Guitars', path: ['Electric Guitars'], isLeaf: true },
    ]);
    const itemUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update)
      .mockReturnValueOnce({ set: itemUpdateSet } as any)      // cache persist-back
      .mockReturnValueOnce({ set: listingUpdateSet } as any);  // listing row update
    mockReverbCreateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'reverb',
        price: 2500,
        publishMode: 'live',
        disclaimerAccepted: true,
      });

    expect(res.status).toBe(201);
    expect(mockReverbSearchCategories).toHaveBeenCalledWith('guitars');
    expect(mockReverbCreateListing.mock.calls[0][0].marketplaceSpecific).toMatchObject({
      categoryUuid: 'rev-cat-guessed',
    });
    const persisted = itemUpdateSet.mock.calls[0][0] as { marketplaceData: { reverb: { categoryUuid: string; categoryName: string } } };
    expect(persisted.marketplaceData.reverb).toMatchObject({
      categoryUuid: 'rev-cat-guessed',
      categoryName: 'Electric Guitars',
    });
    expect(res.body.warning).toMatch(/category guessed/i);
  });

  it('returns 422 REVERB_CATEGORY_REQUIRED when no category can be resolved and never calls createListing', async () => {
    const bareItem = { ...GEAR_ITEM, marketplaceData: null };
    mockSelectOnce([bareItem]);
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);
    mockReverbSearchCategories.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'reverb',
        price: 2500,
        publishMode: 'live',
        disclaimerAccepted: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REVERB_CATEGORY_REQUIRED');
    expect(mockReverbCreateListing).not.toHaveBeenCalled();
  });
});

describe('POST /listings/:id/publish — reverb', () => {
  it('enriches the draft from cache + profile exactly like the create route', async () => {
    const LISTING_ID = '00000000-0000-0000-0000-00000000000a';
    mockSelectOnce([{
      id: LISTING_ID,
      userId: 'test-user-id',
      itemId: ITEM_ID,
      marketplace: 'reverb',
      status: 'draft',
      price: 2500,
      currency: 'USD',
      marketplaceSpecificFields: null,
      ebaySku: null,
    }]);                                               // listing lookup
    mockSelectOnce([GEAR_ITEM]);                       // item lookup
    mockSelectOnce([PROFILE]);                         // enrichment profile lookup
    mockSelectOnce([{ footer: null }]);                // footer lookup
    mockReverbCreateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .post(`/listings/${LISTING_ID}/publish`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(ReverbAdapterMock).toHaveBeenCalledWith('test-user-id');
    expect(mockReverbCreateListing.mock.calls[0][0].marketplaceSpecific).toMatchObject({
      categoryUuid: 'rev-cat-solidbody',
      conditionUuid: 'rev-cond-excellent',
      offersEnabled: false,
      shippingRates: [{ regionCode: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }],
    });
  });

  it('surfaces the category-guess warning in the publish response', async () => {
    const LISTING_ID = '00000000-0000-0000-0000-00000000000a';
    mockSelectOnce([{
      id: LISTING_ID,
      userId: 'test-user-id',
      itemId: ITEM_ID,
      marketplace: 'reverb',
      status: 'draft',
      price: 2500,
      currency: 'USD',
      marketplaceSpecificFields: null,
      ebaySku: null,
    }]);
    mockSelectOnce([{ ...GEAR_ITEM, marketplaceData: null }]);  // no cache — forces guess
    mockSelectOnce([PROFILE]);
    mockSelectOnce([{ footer: null }]);
    mockReverbSearchCategories.mockResolvedValueOnce([
      { id: 'rev-cat-guessed', name: 'Electric Guitars', path: ['Electric Guitars'], isLeaf: true },
    ]);
    const itemUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, status: 'active' }]) }),
    });
    vi.mocked(db.update)
      .mockReturnValueOnce({ set: itemUpdateSet } as any)
      .mockReturnValueOnce({ set: listingUpdateSet } as any);
    mockReverbCreateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .post(`/listings/${LISTING_ID}/publish`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.warning).toMatch(/category guessed/i);
  });
});

describe('POST /listings/bulk/activate — reverb exclusion', () => {
  it('never silent-activates a reverb DB-only draft; reports it as needing publish', async () => {
    const REVERB_DRAFT_ID = '00000000-0000-0000-0000-00000000000b';
    // ownership select resolves at .where() (no .limit())
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: REVERB_DRAFT_ID,
          status: 'draft',
          marketplace: 'reverb',
          marketplaceListingId: null,
          ebaySku: null,
        }]),
      }),
    } as any);

    const res = await request(app)
      .post('/listings/bulk/activate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [REVERB_DRAFT_ID] });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.needsPublish).toBe(1);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });
});
