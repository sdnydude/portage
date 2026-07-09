import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const PUBLISHED_FAQ = {
  id: '00000000-0000-0000-0000-0000000000f1',
  question: 'How do I scan an item?',
  answer: 'Tap the Scan button…',
  sortOrder: 0,
  published: true,
};

function mockOrderedSelect(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let userToken: string;

beforeAll(() => {
  app = createApp();
  userToken = createTestToken({ role: 'user' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /faqs', () => {
  it('returns published FAQs in sort order for any authenticated user', async () => {
    mockOrderedSelect([PUBLISHED_FAQ]);

    const res = await request(app)
      .get('/faqs')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.faqs).toEqual([PUBLISHED_FAQ]);
  });
});

describe('POST /admin/faqs', () => {
  it('creates a FAQ as admin', async () => {
    const adminToken = createTestToken({ role: 'admin' });
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...PUBLISHED_FAQ, id: 'new-id' }]),
    });
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values } as any)
      // audit-log insert
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .post('/admin/faqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'How do I scan an item?', answer: 'Tap the Scan button…', sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.faq.id).toBe('new-id');
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ question: 'How do I scan an item?' }));
  });
});

describe('PATCH /admin/faqs/:id', () => {
  it('updates fields and returns the updated FAQ', async () => {
    const adminToken = createTestToken({ role: 'admin' });
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...PUBLISHED_FAQ, answer: 'Updated answer', published: false }]),
      }),
    });
    vi.mocked(db.update).mockReturnValueOnce({ set } as any);
    vi.mocked(db.insert).mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .patch(`/admin/faqs/${PUBLISHED_FAQ.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ answer: 'Updated answer', published: false });

    expect(res.status).toBe(200);
    expect(res.body.faq.answer).toBe('Updated answer');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ answer: 'Updated answer', published: false }));
  });
});

describe('DELETE /admin/faqs/:id', () => {
  it('deletes the FAQ', async () => {
    const adminToken = createTestToken({ role: 'admin' });
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: PUBLISHED_FAQ.id }]) }),
    } as any);
    vi.mocked(db.insert).mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .delete(`/admin/faqs/${PUBLISHED_FAQ.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});

describe('GET /admin/faqs', () => {
  it('returns ALL FAQs including unpublished, in sort order', async () => {
    const adminToken = createTestToken({ role: 'admin' });
    const unpublished = { ...PUBLISHED_FAQ, id: 'f2', published: false };
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([PUBLISHED_FAQ, unpublished]),
      }),
    } as any);

    const res = await request(app)
      .get('/admin/faqs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.faqs).toHaveLength(2);
    expect(res.body.faqs[1].published).toBe(false);
  });
});

describe('PUT /admin/faqs/reorder', () => {
  it('writes sortOrder from the given id sequence', async () => {
    const adminToken = createTestToken({ role: 'admin' });
    const sets: unknown[] = [];
    vi.mocked(db.update).mockImplementation(() => ({
      set: vi.fn().mockImplementation((v) => {
        sets.push(v);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    }) as any);
    vi.mocked(db.insert).mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .put('/admin/faqs/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: ['f2', 'f1', 'f3'] });

    expect(res.status).toBe(200);
    expect(sets.map((s) => (s as { sortOrder: number }).sortOrder)).toEqual([0, 1, 2]);
  });
});

describe('admin guard', () => {
  it('rejects non-admin users on every admin FAQ route', async () => {
    const paths: Array<[string, string]> = [
      ['post', '/admin/faqs'],
      ['patch', '/admin/faqs/f1'],
      ['delete', '/admin/faqs/f1'],
      ['get', '/admin/faqs'],
      ['put', '/admin/faqs/reorder'],
    ];
    for (const [method, path] of paths) {
      const res = await (request(app) as any)[method](path)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });
});
