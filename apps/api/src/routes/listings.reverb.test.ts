import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

const { mockReverbCreateListing, mockReverbUpdateListing, mockReverbDeleteListing, mockReverbSearchCategories, mockReverbGetListingStatus, ReverbAdapterMock } = vi.hoisted(() => {
  const mockReverbCreateListing = vi.fn();
  const mockReverbUpdateListing = vi.fn();
  const mockReverbDeleteListing = vi.fn();
  const mockReverbSearchCategories = vi.fn();
  const mockReverbGetListingStatus = vi.fn();
  return {
    mockReverbCreateListing,
    mockReverbUpdateListing,
    mockReverbDeleteListing,
    mockReverbSearchCategories,
    mockReverbGetListingStatus,
    ReverbAdapterMock: vi.fn(() => ({
      createListing: mockReverbCreateListing,
      updateListing: mockReverbUpdateListing,
      deleteListing: mockReverbDeleteListing,
      searchCategories: mockReverbSearchCategories,
      getListingStatus: mockReverbGetListingStatus,
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
  it('constructs the adapter with userId and enriches specifics from cache + profile (profile wins raw offersEnabled)', async () => {
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
      offersEnabled: false, // profile owns the RAW key — user intent rides offersEnabledExplicit
      shippingRates: [{ regionCode: 'US_CON', rate: { amount: '45.00', currency: 'USD' } }],
    });
    expect(mockReverbSearchCategories).not.toHaveBeenCalled();
  });

  it('offersEnabledExplicit (publish-sheet toggle) overrides the profile default', async () => {
    mockSelectOnce([GEAR_ITEM]);
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);                         // profile has reverbOffersEnabled: false
    mockSelectOnce([{ footer: null }]);
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
        marketplaceSpecificFields: { offersEnabledExplicit: true },
      });

    expect(res.status).toBe(201);
    const input = mockReverbCreateListing.mock.calls[0][0];
    expect(input.marketplaceSpecific.offersEnabled).toBe(true);
  });

  it('enriches shippingProfileId and localPickup from the seller profile reverbDefaultShipping', async () => {
    mockSelectOnce([GEAR_ITEM]);
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([{
      ...PROFILE,
      reverbDefaultShipping: { shippingProfileId: '456', local: true, rates: [] },
    }]);
    mockSelectOnce([{ footer: null }]);
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
    const input = mockReverbCreateListing.mock.calls[0][0];
    expect(input.marketplaceSpecific.shippingProfileId).toBe('456');
    expect(input.marketplaceSpecific.localPickup).toBe(true);
  });

  it('passes the item conditionNotes through to the adapter input', async () => {
    mockSelectOnce([{ ...GEAR_ITEM, conditionNotes: 'Fret wear on 1-3, small chip on headstock.' }]);
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);
    mockSelectOnce([{ footer: null }]);
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
    const input = mockReverbCreateListing.mock.calls[0][0];
    expect(input.conditionNotes).toBe('Fret wear on 1-3, small chip on headstock.');
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

  it('still publishes with the guessed category when the cache persist-back write fails', async () => {
    const bareItem = { ...GEAR_ITEM, marketplaceData: null };
    mockSelectOnce([bareItem]);
    mockInsertReturning([{ id: 'listing-1', status: 'draft' }]);
    mockSelectOnce([PROFILE]);
    mockSelectOnce([{ footer: null }]);
    mockReverbSearchCategories.mockResolvedValueOnce([
      { id: 'rev-cat-guessed', name: 'Electric Guitars', path: ['Electric Guitars'], isLeaf: true },
    ]);
    // First db.update = the persist-back — blows up (transient DB failure).
    const failingSet = vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error('deadlock')) });
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update)
      .mockReturnValueOnce({ set: failingSet } as any)
      .mockReturnValueOnce({ set: listingUpdateSet } as any);
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
    expect(mockReverbCreateListing.mock.calls[0][0].marketplaceSpecific).toMatchObject({
      categoryUuid: 'rev-cat-guessed',
    });
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

  it('passes the item conditionNotes through to the adapter on draft publish', async () => {
    mockSelectOnce([{ id: 'listing-1', userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb', status: 'draft', price: 2500, currency: 'USD', marketplaceSpecificFields: null, ebaySku: null }]);
    mockSelectOnce([{ ...GEAR_ITEM, conditionNotes: 'Tuners replaced with Grovers.' }]);
    mockSelectOnce([PROFILE]);
    mockSelectOnce([{ footer: null }]);
    mockReverbCreateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockReverbCreateListing.mock.calls[0][0].conditionNotes).toBe('Tuners replaced with Grovers.');
  });

  it('never creates a second Reverb listing when the draft row already has a marketplaceListingId — syncs the live status instead', async () => {
    mockSelectOnce([{ id: 'listing-1', userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb', status: 'draft', price: 76.08, currency: 'USD', marketplaceSpecificFields: null, ebaySku: null, marketplaceListingId: '99270095' }]);
    mockSelectOnce([GEAR_ITEM]);
    mockReverbGetListingStatus.mockResolvedValueOnce('active');

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockReverbCreateListing).not.toHaveBeenCalled();
    expect(mockReverbGetListingStatus).toHaveBeenCalledWith('99270095');
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

describe('GET /listings — reverb async-publish status refresh', () => {
  // Live-verified 2026-07-21: all 6 production reverb rows sat status=draft
  // while the listings were live (4) or sold (2) on Reverb — the create
  // response reports a non-live state and nothing ever re-checked. The list
  // fetch is the natural sync point.
  it('completes a parked publish on list fetch when the remote listing is still a draft (publish PUT flips it live)', async () => {
    const staleRow = {
      id: 'listing-1', userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb',
      status: 'draft', price: 189, currency: 'USD', marketplaceListingId: '99606179',
      publishedAt: null, itemTitle: 'Pelican Case',
    };
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([staleRow]),
                }),
              }),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);
    // Remote is a draft: the public status read cannot see it -> 'unknown'.
    mockReverbGetListingStatus.mockResolvedValueOnce('unknown');
    mockReverbUpdateListing.mockResolvedValueOnce({ marketplaceListingId: '99606179', marketplaceUrl: 'u', status: 'active' });

    const res = await request(app)
      .get('/listings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).toHaveBeenCalledWith('99606179', { marketplaceSpecific: { publish: true } });
    expect(res.body.listings[0].status).toBe('active');
  });

  it('flips a stale reverb draft row to its live remote status on list fetch', async () => {
    const staleRow = {
      id: 'listing-1', userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb',
      status: 'draft', price: 76.08, currency: 'USD', marketplaceListingId: '99270095',
      publishedAt: null, itemTitle: 'ESI MoCo',
    };
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([staleRow]),
                }),
              }),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);
    mockReverbGetListingStatus.mockResolvedValueOnce('active');

    const res = await request(app)
      .get('/listings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockReverbGetListingStatus).toHaveBeenCalledWith('99270095');
    expect(res.body.listings[0].status).toBe('active');
  });
});

describe('PATCH /listings/:id — reverb marketplace sync', () => {
  it('syncs a price edit on an active reverb listing through updateListing', async () => {
    const LISTING_ID = '00000000-0000-0000-0000-00000000000c';
    mockSelectOnce([{
      id: LISTING_ID,
      userId: 'test-user-id',
      itemId: ITEM_ID,
      marketplace: 'reverb',
      status: 'active',
      marketplaceListingId: '87654321',
      price: 2500,
      currency: 'USD',
      marketplaceSpecificFields: null,
      ebaySku: null,
    }]);                                               // listing lookup
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: LISTING_ID, userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb',
          status: 'active', marketplaceListingId: '87654321', price: 2200, currency: 'USD',
          marketplaceSpecificFields: null, ebaySku: null,
        }]),
      }),
    });
    vi.mocked(db.update).mockReturnValueOnce({ set: listingUpdateSet } as any);
    mockSelectOnce([GEAR_ITEM]);                       // item lookup for sync
    mockSelectOnce([{ footer: null, shipFromAddress: null }]); // footer/shipFrom profile row
    mockSelectOnce([PROFILE]);                         // enrichment profile lookup
    mockReverbUpdateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .patch(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 2200 });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).toHaveBeenCalledWith('87654321', expect.objectContaining({
      price: 2200,
      currency: 'USD',
    }));
  });

  it('re-enriches on sync so a post-publish profile offersEnabled change reaches Reverb', async () => {
    const LISTING_ID = '00000000-0000-0000-0000-00000000000c';
    mockSelectOnce([{
      id: LISTING_ID,
      userId: 'test-user-id',
      itemId: ITEM_ID,
      marketplace: 'reverb',
      status: 'active',
      marketplaceListingId: '87654321',
      price: 2500,
      currency: 'USD',
      marketplaceSpecificFields: { offersEnabled: true },  // stored at publish time
      ebaySku: null,
    }]);
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: LISTING_ID, userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb',
          status: 'active', marketplaceListingId: '87654321', price: 2200, currency: 'USD',
          marketplaceSpecificFields: { offersEnabled: true }, ebaySku: null,
        }]),
      }),
    });
    vi.mocked(db.update).mockReturnValueOnce({ set: listingUpdateSet } as any);
    mockSelectOnce([GEAR_ITEM]);                             // item lookup for sync
    mockSelectOnce([{ footer: null, shipFromAddress: null }]); // footer/shipFrom profile row
    mockSelectOnce([{ ...PROFILE, reverbOffersEnabled: false }]); // enrichment profile lookup
    mockReverbUpdateListing.mockResolvedValueOnce({
      marketplaceListingId: '87654321',
      marketplaceUrl: 'https://reverb.com/item/87654321',
      status: 'active',
    });

    const res = await request(app)
      .patch(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 2200 });

    expect(res.status).toBe(200);
    const input = mockReverbUpdateListing.mock.calls[0][1];
    expect(input.marketplaceSpecific).toMatchObject({
      offersEnabled: false,               // live profile wins over publish-time stored value
      categoryUuid: 'rev-cat-solidbody',  // cache still flows on update
    });
  });

  it('archiving an active reverb listing ends it on Reverb via deleteListing', async () => {
    const LISTING_ID = '00000000-0000-0000-0000-00000000000d';
    mockSelectOnce([{
      id: LISTING_ID,
      userId: 'test-user-id',
      itemId: ITEM_ID,
      marketplace: 'reverb',
      status: 'active',
      marketplaceListingId: '87654321',
      price: 2500,
      currency: 'USD',
      marketplaceSpecificFields: null,
      ebaySku: null,
    }]);
    const listingUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: LISTING_ID, userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb',
          status: 'archived', marketplaceListingId: '87654321', price: 2500, currency: 'USD',
          marketplaceSpecificFields: null, ebaySku: null,
        }]),
      }),
    });
    vi.mocked(db.update).mockReturnValueOnce({ set: listingUpdateSet } as any);
    mockReverbDeleteListing.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .patch(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(mockReverbDeleteListing).toHaveBeenCalledWith('87654321');
  });
});

describe('DELETE /listings/:id — reverb remote-draft cleanup', () => {
  // A reverb row can be status=draft while the listing EXISTS remotely (async
  // publish window / remote draft). Deleting only the local row orphans the
  // Reverb listing — found live 2026-07-21 cleaning up a repro listing.
  it('ends the remote Reverb listing even when the local row is still draft', async () => {
    mockSelectOnce([{ id: 'listing-1', userId: 'test-user-id', itemId: ITEM_ID, marketplace: 'reverb', status: 'draft', marketplaceListingId: '99606073' }]);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue([]) } as any);
    mockReverbDeleteListing.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockReverbDeleteListing).toHaveBeenCalledWith('99606073');
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
