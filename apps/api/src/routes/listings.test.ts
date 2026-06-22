import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';
const { mockCreateListing, mockUpdateListing, mockBulkPublishOffers, mockResolveEbayCategoryId } = vi.hoisted(() => ({
  mockCreateListing: vi.fn(),
  mockUpdateListing: vi.fn(),
  mockBulkPublishOffers: vi.fn(),
  mockResolveEbayCategoryId: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: vi.fn(() => ({
    createListing: mockCreateListing,
    updateListing: mockUpdateListing,
    bulkPublishOffers: mockBulkPublishOffers,
  })),
  resolveEbayCategoryId: mockResolveEbayCategoryId,
}));

const ITEM_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_ITEM = {
  id: ITEM_ID,
  userId: 'test-user-id',
  title: 'Sony WH-1000XM4',
  description: 'Noise-cancelling headphones',
  category: 'electronics',
  condition: 'good',
  brand: 'Sony',
  model: 'WH-1000XM4',
  features: [],
  photos: [{ url: 'https://portage-images.digitalharmonyai.com/p.jpg' }],
  quantity: 3,
  // Stable per-item SKU already minted — publish paths reuse it (no re-mint).
  ebaySku: 'PRT-000001',
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

function mockInsertCapture() {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]),
  });
  vi.mocked(db.insert).mockReturnValue({ values } as any);
  return values;
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: resolver finds nothing new, so publish behaves as before unless a test overrides.
  mockResolveEbayCategoryId.mockResolvedValue({ categoryId: null, categoryName: null, newlyResolved: false });
});

describe('POST /listings', () => {
  it('merges item weight/dimensions into marketplaceSpecific on eBay publish', async () => {
    mockSelectOnce([
      { ...MOCK_ITEM, weightOz: 56, lengthIn: 10, widthIn: 8, heightIn: 4, ebayPackageType: 'MAILING_BOX' },
    ]);
    mockSelectOnce([]); // seller profile (none — policy self-heal finds nothing)
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplaceSpecific: expect.objectContaining({
          categoryId: '123',
          weight: { value: 56, unit: 'OUNCE' },
          dimensions: { length: 10, width: 8, height: 4, unit: 'INCH' },
          packageType: 'MAILING_BOX',
        }),
      }),
    );
  });

  it('carries item.aspects into marketplaceSpecific on publish, client aspects winning per key', async () => {
    mockSelectOnce([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'], Color: ['Black'] } }]);
    mockSelectOnce([]); // seller profile (policy self-heal)
    mockSelectOnce([]); // footer lookup
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        // Client overrides Color; Brand is only on the stored item.
        marketplaceSpecificFields: { categoryId: '123', aspects: { Color: ['Red'] } },
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplaceSpecific: expect.objectContaining({
          aspects: { Brand: ['Sony'], Color: ['Red'] },
        }),
      }),
    );
  });

  it('derives input.mpn from the merged aspects MPN and passes it to the adapter', async () => {
    mockSelectOnce([{ ...MOCK_ITEM, aspects: { MPN: ['WH1000XM4/B'] } }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ mpn: 'WH1000XM4/B' }));
  });

  it('passes the item\'s stable serialized SKU to the eBay adapter instead of a fresh random one', async () => {
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: 'PRT-000007' }]); // item already carries a stable SKU
    mockSelectOnce([]); // seller profile (policy self-heal)
    mockSelectOnce([]); // footer lookup
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active', ebaySku: 'PRT-000007' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({ ebaySku: 'PRT-000007' }),
    );
  });

  it('self-heals the eBay leaf category from the item cache when a live create omits categoryId', async () => {
    mockSelectOnce([MOCK_ITEM]); // item lookup
    mockSelectOnce([]); // seller profile (none — policy self-heal finds nothing)
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    // The item has a cached eBay category; the request body carries none.
    mockResolveEbayCategoryId.mockResolvedValue({ categoryId: '175669', categoryName: 'Solid State Drives', newlyResolved: false });
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 219,
        publishMode: 'live',
        // no marketplaceSpecificFields.categoryId — the create route must self-heal it
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplaceSpecific: expect.objectContaining({ categoryId: '175669' }),
      }),
    );
  });

  it('surfaces the adapter warning (e.g. Best Offer downgrade) in the create response', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // seller profile (none — policy self-heal finds nothing)
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: 'ebay-1', status: 'active',
      warning: 'Listed without Best Offer auto-accept — eBay rejected it for this listing.',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    expect(res.body.warning).toMatch(/best offer/i);
  });

  it('passes publishMode live explicitly to the adapter on POST /:id/publish', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: null, marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // seller profile (policy self-heal)
    mockSelectOnce([]); // footer lookup
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: 'ebay-1',
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({ publishMode: 'live' }),
    );
  });

  it('carries item.aspects into the adapter on POST /:id/publish, client aspects winning', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: null,
      marketplaceSpecificFields: { categoryId: '15032', aspects: { Color: ['Red'] } },
    }]);
    mockSelectOnce([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'], Color: ['Black'] } }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: 'ebay-1',
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplaceSpecific: expect.objectContaining({ aspects: { Brand: ['Sony'], Color: ['Red'] } }),
      }),
    );
  });

  it('derives input.mpn from aspects on POST /:id/publish', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: null,
      marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    mockSelectOnce([{ ...MOCK_ITEM, aspects: { MPN: ['ABC-123'] } }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: 'ebay-1',
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ mpn: 'ABC-123' }));
  });

  it('publish reuses the item\'s stable serialized SKU even when the draft listing has none', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: null, ebaySku: null, ebayOfferId: null,
      marketplaceSpecificFields: { categoryId: '15032' },
    }]); // draft listing carries NO sku
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: 'PRT-000009' }]); // item holds the stable sku
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: 'ebay-1',
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active', ebaySku: 'PRT-000009' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({ ebaySku: 'PRT-000009' }),
    );
  });

  it('publish reuses a legacy draft\'s own SKU rather than minting a new one (no orphaned eBay inventory)', async () => {
    // A draft created before the stable-SKU change: it carries the legacy SKU,
    // but the item column was never backfilled. Minting a fresh SKU here would PUT
    // a brand-new inventory_item yet activate the OLD offer — orphaning the new one.
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: null, ebaySku: 'portage-1737000000-ab12cd', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: null }]); // item never backfilled
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 199, currency: 'USD', marketplaceListingId: 'ebay-1',
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active', ebaySku: 'portage-1737000000-ab12cd' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({ ebaySku: 'portage-1737000000-ab12cd' }),
    );
  });

  it('persists ebaySku and ebayOfferId from the publish result', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // seller profile (none — policy self-heal finds nothing)
    mockSelectOnce([]); // footer lookup — no seller profile
    const insertValues = mockInsertCapture();
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110012345678',
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishImmediately: true });

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
      marketplaceListingId: '110012345678',
    }));
  });

  it('self-heals eBay policy IDs from the seller profile when a live POST / publish lacks them', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([{
      ebayFulfillmentPolicyId: 'fp-9', ebayPaymentPolicyId: 'pp-9',
      ebayReturnPolicyId: 'rp-9', ebayMerchantLocationKey: 'loc-9',
    }]);
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({
        categoryId: '123',
        fulfillmentPolicyId: 'fp-9',
        paymentPolicyId: 'pp-9',
        returnPolicyId: 'rp-9',
        merchantLocationKey: 'loc-9',
      }),
    }));
  });

  it('keeps body-provided policy IDs over profile values (body wins, profile fills gaps)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([{
      ebayFulfillmentPolicyId: 'fp-9', ebayPaymentPolicyId: 'pp-9',
      ebayReturnPolicyId: 'rp-9', ebayMerchantLocationKey: 'loc-9',
    }]);
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'live',
        marketplaceSpecificFields: { categoryId: '123', fulfillmentPolicyId: 'fp-body' },
      });

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({
        fulfillmentPolicyId: 'fp-body',
        paymentPolicyId: 'pp-9',
        returnPolicyId: 'rp-9',
        merchantLocationKey: 'loc-9',
      }),
    }));
  });

  it('publishMode live publishes (without legacy publishImmediately) and forwards the item quantity', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // seller profile (none — policy self-heal finds nothing)
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live' });

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });
});

describe('POST /listings — seller listing footer', () => {
  it('appends the seller default footer on create-and-publish', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // seller profile (policy self-heal — none)
    // The footer select projects { footer: sellerProfiles.defaultListingFooter }.
    mockSelectOnce([{ footer: 'Ships fast.' }]);
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live' });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Noise-cancelling headphones\n\nShips fast.',
    }));
  });
});

describe('POST /listings/:id/publish — seller listing footer', () => {
  it('appends the seller default footer to the description sent to the marketplace', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    // The footer select projects { footer: sellerProfiles.defaultListingFooter }.
    mockSelectOnce([{ footer: 'Ships fast from a smoke-free studio.' }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Noise-cancelling headphones\n\nShips fast from a smoke-free studio.',
    }));
  });
});

describe('POST /listings/:id/publish', () => {
  it('reuses the stored ebaySku and ebayOfferId when re-publishing (no orphan)', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    // Post-backfill invariant: the item carries the same SKU the listing was
    // published under, so re-publish reuses it (no orphaned inventory item).
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: 'portage-sku-1' }]);
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1', status: 'active',
    });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
    }));
  });

  it('self-heals the eBay leaf category at publish when the listing has none', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: null, ebayOfferId: null,
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockResolveEbayCategoryId.mockResolvedValue({ categoryId: '111422', categoryName: 'Laptops', newlyResolved: true });
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockResolveEbayCategoryId).toHaveBeenCalled();
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ categoryId: '111422' }),
    }));
  });

  it('surfaces the publish warning when eBay activation falls back to draft instead of reporting success', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'draft' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: 'offer-1', ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      status: 'draft', warning: 'Listing created as draft — publish to eBay failed.',
    });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.warning).toMatch(/publish to eBay failed/i);
  });

  it('self-heals eBay setup fields from the seller profile when the draft lacks them', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: null, ebayOfferId: null, marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([{
      ebayFulfillmentPolicyId: 'fp-9', ebayPaymentPolicyId: 'pp-9',
      ebayReturnPolicyId: 'rp-9', ebayMerchantLocationKey: 'loc-9',
    }]);
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({
        fulfillmentPolicyId: 'fp-9',
        paymentPolicyId: 'pp-9',
        returnPolicyId: 'rp-9',
        merchantLocationKey: 'loc-9',
      }),
    }));
  });
});

describe('PATCH /listings/:id', () => {
  it('appends the seller default footer when syncing an update to the marketplace', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([MOCK_ITEM]);
    // The footer select projects { footer: sellerProfiles.defaultListingFooter }.
    mockSelectOnce([{ footer: 'Ships fast.' }]);
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '110012345678', status: 'active' });

    const res = await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(res.status).toBe(200);
    expect(mockUpdateListing).toHaveBeenCalledWith('110012345678', expect.objectContaining({
      description: 'Noise-cancelling headphones\n\nShips fast.',
    }));
  });

  it('carries item.aspects into the adapter on PATCH /:id sync', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'] } }]);
    mockSelectOnce([]); // footer lookup
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '110012345678', status: 'active' });

    await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(mockUpdateListing).toHaveBeenCalledWith('110012345678', expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ aspects: { Brand: ['Sony'] } }),
    }));
  });

  it('surfaces the adapter sync warning (e.g. Best Offer downgrade) in the PATCH response', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — no seller profile
    mockUpdateListing.mockResolvedValue({
      marketplaceListingId: '110012345678', status: 'active',
      warning: 'Updated without Best Offer auto-accept — eBay rejected it for this listing.',
    });

    const res = await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(res.status).toBe(200);
    expect(res.body.warning).toMatch(/best offer/i);
  });

  it('syncs full item fields to eBay including ebaySku and ebayOfferId', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
        marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — no seller profile
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '110012345678', status: 'active' });

    const res = await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(res.status).toBe(200);
    expect(mockUpdateListing).toHaveBeenCalledWith('110012345678', expect.objectContaining({
      title: 'Sony WH-1000XM4',
      description: 'Noise-cancelling headphones',
      price: 179,
      currency: 'USD',
      condition: 'good',
      quantity: 3,
      brand: 'Sony',
      model: 'WH-1000XM4',
      photos: [{ url: 'https://portage-images.digitalharmonyai.com/p.jpg' }],
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
    }));
  });
});

describe('POST /listings/:id/publish — persistence', () => {
  it('persists the result ebaySku and ebayOfferId after publishing a DB-only draft', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: null, ebayOfferId: null,
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'new-sku', ebayOfferId: 'new-offer', status: 'active',
    });

    await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'new-sku',
      ebayOfferId: 'new-offer',
    }));
  });
});

function mockSelectBulk(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

const LISTING_1 = '10000000-0000-0000-0000-000000000001';
const LISTING_2 = '10000000-0000-0000-0000-000000000002';

describe('POST /bulk/activate', () => {
  it('publishes eBay drafts via bulkPublishOffers and updates their status', async () => {
    mockSelectBulk([
      { id: LISTING_1, status: 'draft', marketplace: 'ebay', marketplaceListingId: 'offer-1', ebayOfferId: 'offer-1', ebaySku: 'sku-1' },
      { id: LISTING_2, status: 'draft', marketplace: 'ebay', marketplaceListingId: 'offer-2', ebayOfferId: 'offer-2', ebaySku: 'sku-2' },
    ]);
    mockBulkPublishOffers.mockResolvedValue([
      { offerId: 'offer-1', listingId: '110001', success: true },
      { offerId: 'offer-2', listingId: '110002', success: true },
    ]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'x' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .post('/listings/bulk/activate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [LISTING_1, LISTING_2] });

    expect(res.body).toMatchObject({ published: 2 });
    expect(res.status).toBe(200);
    expect(mockBulkPublishOffers).toHaveBeenCalledWith(['offer-1', 'offer-2']);
    expect(res.body.ids).toEqual(expect.arrayContaining([LISTING_1, LISTING_2]));
  });
});
