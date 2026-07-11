import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';
import { AppError } from '../middleware/error.js';
const { mockCreateListing, mockUpdateListing, mockBulkPublishOffers, mockResolveEbayCategoryId, mockGetEbayItemVerification, mockDeleteListing, mockWithdrawOffer } = vi.hoisted(() => ({
  mockCreateListing: vi.fn(),
  mockUpdateListing: vi.fn(),
  mockBulkPublishOffers: vi.fn(),
  mockResolveEbayCategoryId: vi.fn(),
  mockGetEbayItemVerification: vi.fn(),
  mockDeleteListing: vi.fn(),
  mockWithdrawOffer: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: vi.fn(() => ({
    createListing: mockCreateListing,
    updateListing: mockUpdateListing,
    bulkPublishOffers: mockBulkPublishOffers,
    getEbayItemVerification: mockGetEbayItemVerification,
    deleteListing: mockDeleteListing,
    withdrawOffer: mockWithdrawOffer,
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
  // Default db.update for the insert-first→update publish path (R3): the create route
  // now inserts a draft row then UPDATEs it with the eBay result. Tests that assert the
  // update payload override this with their own updateSet spy.
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    }),
  } as any);
});

describe('POST /listings', () => {
  it('inserts the listing row BEFORE calling eBay so a crash after publish leaves no orphan (insert-first, R3)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup
    const insertValues = mockInsertCapture();
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active', marketplaceListingId: '3001' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '3001', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live' });

    // The DB row must be inserted before the eBay AddFixedPriceItem call: if the
    // process dies between the eBay 200 and the insert, an insert-after design
    // leaves a live listing with no Portage row (an unrecoverable orphan).
    expect(insertValues.mock.invocationCallOrder[0])
      .toBeLessThan(mockCreateListing.mock.invocationCallOrder[0]);
  });

  it('persists a client-supplied idempotencyKey on the insert-first row (R3 dedup anchor)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup
    const insertValues = mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '3001', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live', idempotencyKey: 'client-key-123' });

    // The client's key must reach the row so a retried submit collides on the unique
    // index instead of double-listing; a server-generated UUID would never collide.
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'client-key-123' }));
  });

  it('replays the existing listing (no eBay call) when the idempotencyKey collides (R3)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    // insert-first hits the partial unique index — Postgres raises 23505.
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      }),
    } as any);
    mockSelectOnce([{ id: 'listing-existing', status: 'active', marketplaceListingId: '3001' }]); // prior row for this key

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live', idempotencyKey: 'dup-key' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('listing-existing');
    expect(mockCreateListing).not.toHaveBeenCalled(); // must NOT publish a second time
  });

  it('resumes the publish when the colliding row is an unpublished draft (retry after failed publish)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    // insert-first collides: a prior live-publish attempt inserted the row, then
    // the adapter call failed — the row is still a draft with no marketplace id.
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      }),
    } as any);
    mockSelectOnce([{ id: 'listing-existing', status: 'draft', marketplaceListingId: null }]); // prior row for this key
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'listing-existing', status: 'active', marketplaceListingId: '3001' }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '3001', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live', idempotencyKey: 'dup-key' });

    // Returning the stale draft here would report a silent no-op "success" to the
    // client — the retry must actually publish and return the live row.
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('listing-existing');
    expect(res.body.status).toBe('active');
    expect(mockCreateListing).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ marketplaceListingId: '3001' }));
  });

  it('refreshes the resumed row from the retry body so an edited price is what gets published', async () => {
    mockSelectOnce([MOCK_ITEM]);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      }),
    } as any);
    // Prior attempt inserted the row at 199; the user fixed the price to 250 and retried.
    mockSelectOnce([{ id: 'listing-existing', status: 'draft', marketplaceListingId: null, price: 199 }]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'listing-existing', status: 'active', marketplaceListingId: '3001' }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '3001', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 250, publishMode: 'live', idempotencyKey: 'dup-key' });

    // The stale draft row must be refreshed before publish — otherwise the row keeps
    // the old price while eBay lists the new one (or vice versa).
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ price: 250 }));
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ price: 250 }));
  });

  it('replays without publishing when a concurrent retry already claimed the stuck draft', async () => {
    mockSelectOnce([MOCK_ITEM]);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      }),
    } as any);
    // Both retries read the same resumable draft…
    mockSelectOnce([{ id: 'listing-existing', status: 'draft', marketplaceListingId: null }]);
    // …but the conditional claim UPDATE (status='draft' AND marketplace_listing_id
    // IS NULL) returns no row for the loser — the winner already claimed it.
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    // The loser re-reads and replays whatever state the winner produced.
    mockSelectOnce([{ id: 'listing-existing', status: 'active', marketplaceListingId: '3001' }]);

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live', idempotencyKey: 'dup-key' });

    // Publishing here would double-list on eBay — the unique index only
    // serializes the INSERT; the claim UPDATE must serialize the resume.
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('listing-existing');
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it('returns the existing row untouched on a draft-mode collision (pure dedup, no resume)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      }),
    } as any);
    mockSelectOnce([{ id: 'listing-existing', status: 'draft', marketplaceListingId: null }]);

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'draft', idempotencyKey: 'dup-key' });

    // Draft-mode never publishes, so a collision is a double-submit — replay as-is.
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('listing-existing');
    expect(mockCreateListing).not.toHaveBeenCalled();
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('detects the 23505 when drizzle wraps it in DrizzleQueryError (code on e.cause)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    // What postgres-js + drizzle actually throw live: a DrizzleQueryError whose
    // .cause carries the PostgresError with code 23505 — NOT a bare error with a
    // top-level code. Live-proven 2026-07-09: the top-level-only check 500'd every
    // same-key replay in production.
    const wrapped = Object.assign(new Error('Failed query: insert into "listings" ...'), {
      cause: Object.assign(new Error('duplicate key value violates unique constraint "uq_listings_idempotency_key"'), { code: '23505' }),
    });
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(wrapped),
      }),
    } as any);
    mockSelectOnce([{ id: 'listing-existing', status: 'active', marketplaceListingId: '3001' }]);

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live', idempotencyKey: 'dup-key' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('listing-existing');
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

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

  it('publishMode "ebay_draft" saves a DB-only draft and does NOT call the adapter (Trading has no unpublished offer — N1)', async () => {
    mockSelectOnce([{ ...MOCK_ITEM }]);
    const values = mockInsertCapture();

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemId: ITEM_ID,
        marketplace: 'ebay',
        price: 100,
        publishMode: 'ebay_draft',
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    // ebay_draft is now a local draft only — no eBay call (AddFixedPriceItem publishes
    // live; there is no unpublished-offer concept under Trading).
    expect(mockCreateListing).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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

  it('persists the ebaySku from the publish result (via the insert-first UPDATE)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup — no seller profile
    mockInsertCapture(); // insert-first draft row (marketplaceListingId null)
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110012345678',
      ebaySku: 'portage-sku-1',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishImmediately: true });

    expect(res.status).toBe(201);
    // The eBay result lands on the UPDATE, not the insert (the insert-first row starts null).
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
      marketplaceListingId: '110012345678',
    }));
  });

  it('injects the ship-from origin ZIP from the seller profile when a live create lacks it (inline calculated shipping)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([{ shipFromAddress: { zip: '90210' } }]); // seller profile ship-from (canonical key is `zip`)
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
        marketplaceSpecificFields: { categoryId: '123' },
      });

    expect(res.status).toBe(201);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ categoryId: '123', originPostalCode: '90210' }),
    }));
  });

  it('keeps a body-provided origin ZIP over the profile (body wins, profile not consulted)', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // footer lookup — ship-from not consulted because body supplied originPostalCode
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
        marketplaceSpecificFields: { categoryId: '123', originPostalCode: '10001' },
      });

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ categoryId: '123', originPostalCode: '10001' }),
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
  it('reuses the stored ebaySku when re-publishing (no orphan)', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    // Post-backfill invariant: the item carries the same SKU the listing was
    // published under, so re-publish reuses it (no orphaned inventory item).
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: 'portage-sku-1' }]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'portage-sku-1', status: 'active',
    });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
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

  it('injects the ship-from origin ZIP from the seller profile when a draft publish lacks it (inline calculated shipping)', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1',
      marketplaceSpecificFields: { categoryId: '15032', fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([{ ...MOCK_ITEM, ebaySku: 'portage-sku-1' }]);
    mockSelectOnce([{ shipFromAddress: { zip: '90210' } }]); // applyShipFromOrigin reads the seller profile (key is `zip`)
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ originPostalCode: '90210' }),
    }));
  });
});

describe('PATCH /listings/:id', () => {
  it('saves locally with a warning when a stray parked-etsy row hits the sync path', async () => {
    // Etsy is parked (tag etsy-parked-2026-07): the DB enum value remains, so a
    // row CAN carry marketplace='etsy'. The local write lands BEFORE the sync,
    // so throwing 400 here would tell the client nothing saved when the new
    // price is already persisted — report the truth: saved + not synced.
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'etsy',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      marketplaceListingId: 'etsy-123', marketplaceSpecificFields: null,
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'etsy',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        marketplaceListingId: 'etsy-123', marketplaceSpecificFields: null,
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([MOCK_ITEM]);

    const res = await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(179); // the local save is real — report it
    expect(res.body.warning).toMatch(/not supported|unavailable/i);
  });

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

  it('injects the seller ship-from origin ZIP into the eBay content sync (Trade-First revise needs it)', async () => {
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
    mockSelectOnce([{ footer: null, shipFromAddress: { zip: '90210' } }]);
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '110012345678', status: 'active' });

    await request(app)
      .patch('/listings/listing-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 179 });

    expect(mockUpdateListing).toHaveBeenCalledWith('110012345678', expect.objectContaining({
      marketplaceSpecific: expect.objectContaining({ originPostalCode: '90210' }),
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

  it('syncs full item fields to eBay including ebaySku', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'active', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1',
      marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
    }]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
        id: 'listing-1', status: 'active', marketplace: 'ebay',
        itemId: ITEM_ID, price: 179, currency: 'USD',
        ebaySku: 'portage-sku-1',
        marketplaceListingId: '110012345678', marketplaceSpecificFields: { categoryId: '15032' },
      }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // profile (footer + ship-from) lookup — no seller profile
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
    }));
  });
});

describe('POST /listings/:id/publish — persistence', () => {
  it('persists the result ebaySku after publishing a DB-only draft', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: null,
      marketplaceSpecificFields: { fulfillmentPolicyId: 'fp', paymentPolicyId: 'pp', returnPolicyId: 'rp', merchantLocationKey: 'loc' },
    }]);
    mockSelectOnce([MOCK_ITEM]);
    mockSelectOnce([]); // applyShipFromOrigin (ship-from origin ZIP)
    mockSelectOnce([]); // footer lookup — no seller profile
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'new-sku', status: 'active',
    });

    await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'new-sku',
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

describe('PATCH /listings/:id — price change syncs to the live eBay listing', () => {
  const LID = '00000000-0000-0000-0000-0000000000d2';

  it('includes item weight/dims when syncing a price change to an ACTIVE eBay listing (avoids eBay 25020)', async () => {
    mockSelectOnce([{ id: LID, userId: 'test-user-id', marketplace: 'ebay', status: 'active', marketplaceListingId: '307022414462', ebayOfferId: '193549052011', ebaySku: 'PRT-000009', currency: 'USD' }]);
    const setMock = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: LID, marketplace: 'ebay', status: 'active', marketplaceListingId: '307022414462', ebayOfferId: '193549052011', ebaySku: 'PRT-000009', price: 162, currency: 'USD', itemId: ITEM_ID }]) })) }));
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);
    mockSelectOnce([{ ...MOCK_ITEM, weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3 }]); // item with weight/dims
    mockSelectOnce([]); // footer
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307022414462', status: 'active' });

    const res = await request(app)
      .patch(`/listings/${LID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 162 });

    expect(res.status).toBe(200);
    const [, inputArg] = mockUpdateListing.mock.calls[0] as [string, { marketplaceSpecific?: Record<string, unknown> }];
    expect(inputArg.marketplaceSpecific?.weight, 'weight must be sent on update or eBay rejects with 25020').toBeDefined();
  });
});

describe('PATCH /listings/:id — archive ends the eBay listing via EndFixedPriceItem', () => {
  const LID = '00000000-0000-0000-0000-0000000000a0';
  it('ends the listing by Trading ItemID via deleteListing and archives locally', async () => {
    mockSelectOnce([{ id: LID, userId: 'test-user-id', marketplace: 'ebay', status: 'active', marketplaceListingId: '307022338248', ebayOfferId: null }]);
    mockDeleteListing.mockResolvedValue(undefined);
    const setMock = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: LID, status: 'archived', marketplace: 'ebay', marketplaceListingId: '307022338248' }]) })) }));
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const res = await request(app)
      .patch(`/listings/${LID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(mockDeleteListing).toHaveBeenCalledWith('307022338248');
    expect(mockWithdrawOffer).not.toHaveBeenCalled();
  });

  it('archives locally with a warning when the eBay end-listing call fails — not blocked', async () => {
    mockSelectOnce([{ id: LID, userId: 'test-user-id', marketplace: 'ebay', status: 'active', marketplaceListingId: '307022338248', ebayOfferId: null }]);
    mockDeleteListing.mockRejectedValue(new AppError(404, 'EBAY_API_ERROR', 'The auction has already been closed.'));
    const setMock = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: LID, status: 'archived', marketplace: 'ebay', marketplaceListingId: '307022338248' }]) })) }));
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const res = await request(app)
      .patch(`/listings/${LID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });
});

describe('POST /listings — disclaimer consent (F3a)', () => {
  it('records a disclaimer acceptance against the new listing id on a live publish with disclaimerAccepted', async () => {
    mockSelectOnce([{ ...MOCK_ITEM }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const inserts: Array<Record<string, unknown>> = [];
    const mk = (ret: unknown) => ({
      values: vi.fn((v: Record<string, unknown>) => { inserts.push(v); return { returning: vi.fn().mockResolvedValue(ret) }; }),
    });
    vi.mocked(db.insert)
      .mockReturnValueOnce(mk([{ id: 'listing-1', status: 'active' }]) as any)
      .mockReturnValueOnce(mk([{ id: 'acc-1' }]) as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 100, publishMode: 'live', disclaimerAccepted: true });

    expect(res.status).toBe(201);
    const acceptance = inserts.find((v) => 'disclaimerVersion' in v);
    expect(acceptance, 'an acceptance row should be inserted').toBeDefined();
    expect(acceptance).toMatchObject({ listingId: 'listing-1', disclaimerVersion: 1 });
  });

  it('does not record an acceptance when disclaimerAccepted is absent', async () => {
    mockSelectOnce([{ ...MOCK_ITEM }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    const inserts: Array<Record<string, unknown>> = [];
    const mk = (ret: unknown) => ({
      values: vi.fn((v: Record<string, unknown>) => { inserts.push(v); return { returning: vi.fn().mockResolvedValue(ret) }; }),
    });
    vi.mocked(db.insert).mockReturnValue(mk([{ id: 'listing-1', status: 'active' }]) as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 100, publishMode: 'live' });

    expect(res.status).toBe(201);
    expect(inserts.find((v) => 'disclaimerVersion' in v)).toBeUndefined();
  });

  it('sets a 7-day disclaimer suppression on the user when suppress7d on a live publish', async () => {
    mockSelectOnce([{ ...MOCK_ITEM }]);
    mockSelectOnce([]); // seller profile
    mockSelectOnce([]); // footer
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) })),
    } as any);
    // db.update now runs twice: the insert-first listing UPDATE (needs .where().returning())
    // then the users suppression UPDATE (awaits .where()). One spy serves both.
    const setMock = vi.fn((_v: Record<string, unknown>) => ({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    }));
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);
    mockCreateListing.mockResolvedValue({ marketplaceListingId: 'ebay-1', status: 'active' });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 100, publishMode: 'live', disclaimerAccepted: true, suppress7d: true });

    expect(res.status).toBe(201);
    const suppressCall = setMock.mock.calls
      .map((c) => c[0] as { disclaimerSuppressUntil?: Date; disclaimerSuppressVersion?: number })
      .find((v) => v.disclaimerSuppressVersion !== undefined);
    expect(suppressCall).toBeDefined();
    expect(suppressCall!.disclaimerSuppressVersion).toBe(1);
    expect(suppressCall!.disclaimerSuppressUntil).toBeInstanceOf(Date);
    expect(suppressCall!.disclaimerSuppressUntil!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('POST /bulk/activate', () => {
  it('does NOT silently mark an eBay DB-only draft active (no offer) — flags it to publish individually (G6)', async () => {
    // Under the Trading API an eBay draft is DB-only: no marketplaceListingId, no ebayOfferId.
    // Bulk-activate must NOT flip it to "active" with no eBay call (that shows a live-looking
    // listing that does not exist on eBay).
    mockSelectBulk([
      { id: LISTING_1, status: 'draft', marketplace: 'ebay', marketplaceListingId: null, ebayOfferId: null, ebaySku: 'sku-1' },
    ]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .post('/listings/bulk/activate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [LISTING_1] });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.ids).not.toContain(LISTING_1);
    expect(res.body.needsPublish).toBe(1);
    expect(updateSet).not.toHaveBeenCalled(); // never marked active locally
    expect(mockBulkPublishOffers).not.toHaveBeenCalled();
  });
});

describe('DELETE /listings/:id — Trade-First end-or-local-delete', () => {
  const LISTING_ID = '00000000-0000-0000-0000-0000000000d1';

  it('deletes a DB-only eBay draft locally with no eBay call (nothing live to end)', async () => {
    mockSelectOnce([{
      id: LISTING_ID, userId: 'test-user-id', marketplace: 'ebay',
      status: 'draft', marketplaceListingId: null,
    }]);
    const whereDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereDelete } as any);

    const res = await request(app)
      .delete(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockDeleteListing).not.toHaveBeenCalled();
    expect(whereDelete).toHaveBeenCalled();
  });

  it('ends a live eBay listing by Trading ItemID (deleteListing) when deleting an active listing', async () => {
    mockSelectOnce([{
      id: LISTING_ID, userId: 'test-user-id', marketplace: 'ebay',
      status: 'active', marketplaceListingId: '307022338248',
    }]);
    mockDeleteListing.mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .delete(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockDeleteListing).toHaveBeenCalledWith('307022338248');
  });

  it('bulk delete removes a DB-only eBay draft with no eBay call', async () => {
    mockSelectBulk([
      { id: '10000000-0000-0000-0000-0000000000a1', status: 'draft', marketplace: 'ebay', marketplaceListingId: null },
    ]);
    vi.mocked(db.transaction).mockImplementation(async (cb: any) =>
      cb({ delete: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: '10000000-0000-0000-0000-0000000000a1' }]) }) }) }),
    );

    const res = await request(app)
      .post('/listings/bulk/delete')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: ['10000000-0000-0000-0000-0000000000a1'] });

    expect(res.status).toBe(200);
    expect(mockDeleteListing).not.toHaveBeenCalled();
  });

  it('delete is best-effort: a failed eBay end-listing still deletes locally', async () => {
    mockSelectOnce([{
      id: LISTING_ID, userId: 'test-user-id', marketplace: 'ebay',
      status: 'active', marketplaceListingId: '307022338248',
    }]);
    mockDeleteListing.mockRejectedValue(new Error('eBay 500'));
    const whereDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereDelete } as any);

    const res = await request(app)
      .delete(`/listings/${LISTING_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(whereDelete).toHaveBeenCalled();
  });
});

describe('GET /listings — list includes the item title', () => {
  it('projects itemTitle via an items join so the listings page can show what each listing IS', async () => {
    // Results chain: select(projection).from().leftJoin().where().orderBy().limit().offset()
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.offset = vi.fn().mockResolvedValue([
      { id: 'listing-1', status: 'active', marketplace: 'ebay', price: 199, itemTitle: 'Sony WH-1000XM4' },
    ]);
    vi.mocked(db.select).mockReturnValueOnce(chain as never);
    // Count chain: select({count}).from().where()
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 1 }]);
    vi.mocked(db.select).mockReturnValueOnce(countChain as never);

    const res = await request(app)
      .get('/listings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.listings[0].itemTitle).toBe('Sony WH-1000XM4');
    // The projection itself must carry itemTitle (a bare select() would just
    // pass the mock rows through and prove nothing).
    const projection = vi.mocked(db.select).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(projection).toBeDefined();
    expect(projection).toHaveProperty('itemTitle');
    expect(chain.leftJoin).toHaveBeenCalled();
  });
});

describe('GET /listings — itemId filter', () => {
  it('filters by itemId when provided', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.offset = vi.fn().mockResolvedValue([]);
    vi.mocked(db.select).mockReturnValueOnce(chain as never);
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 0 }]);
    vi.mocked(db.select).mockReturnValueOnce(countChain as never);

    const res = await request(app)
      .get('/listings?itemId=c19d41df-6807-4efc-8436-ea5289f4c4fa')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });

  it('applies itemId to the WHERE clause as a bound param', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.offset = vi.fn().mockResolvedValue([]);
    vi.mocked(db.select).mockReturnValueOnce(chain as never);
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 0 }]);
    vi.mocked(db.select).mockReturnValueOnce(countChain as never);

    await request(app)
      .get('/listings?itemId=c19d41df-6807-4efc-8436-ea5289f4c4fa')
      .set('Authorization', `Bearer ${authToken}`);

    // A schema-only change (param accepted but ignored) must fail here: the
    // itemId has to reach the WHERE clause as a bound param or every listing
    // is returned regardless of the filter.
    const collectParams = (node: unknown, out: unknown[] = []): unknown[] => {
      if (!node || typeof node !== 'object') return out;
      const n = node as { value?: unknown; queryChunks?: unknown[]; constructor?: { name?: string } };
      if (n.constructor?.name === 'Param') { out.push(n.value); return out; }
      if (Array.isArray(node)) { for (const c of node) collectParams(c, out); return out; }
      if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) collectParams(c, out);
      return out;
    };
    expect(collectParams(chain.where.mock.calls[0][0])).toContain('c19d41df-6807-4efc-8436-ea5289f4c4fa');
  });

  it('rejects a non-uuid itemId with 400', async () => {
    const res = await request(app)
      .get('/listings?itemId=not-a-uuid')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /listings/:id/ebay-offer — F-GATE verification read', () => {
  const LISTING_ID = '00000000-0000-0000-0000-0000000000ef';

  it('reads back live eBay state by Trading ItemID (marketplaceListingId)', async () => {
    mockSelectOnce([{ id: LISTING_ID, userId: 'test-user-id', marketplace: 'ebay', ebaySku: 'PRT-000009', marketplaceListingId: '307019237500' }]);
    mockGetEbayItemVerification.mockResolvedValue({
      sku: 'PRT-000009', found: true,
      aspects: { MPN: ['HD600'], Brand: ['Sennheiser'] },
      mpn: 'HD600', brand: 'Sennheiser',
      status: 'Active', listingId: '307019237500', price: '349',
    });

    const res = await request(app)
      .get(`/listings/${LISTING_ID}/ebay-offer`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sku: 'PRT-000009', mpn: 'HD600', listingId: '307019237500' });
    expect(res.body.aspects.MPN).toEqual(['HD600']);
    expect(mockGetEbayItemVerification).toHaveBeenCalledWith('307019237500');
  });

  it('returns found:false without calling eBay when the listing was never published (no ItemID)', async () => {
    mockSelectOnce([{ id: LISTING_ID, userId: 'test-user-id', marketplace: 'ebay', ebaySku: 'PRT-000010', marketplaceListingId: null }]);

    const res = await request(app)
      .get(`/listings/${LISTING_ID}/ebay-offer`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(mockGetEbayItemVerification).not.toHaveBeenCalled();
  });
});
