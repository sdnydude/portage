import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /survey/design-review (unauthenticated by design)', () => {
  it('saves a valid response and returns its id', async () => {
    const insertValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'survey-1' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

    const res = await request(app)
      .post('/survey/design-review')
      .send({ preferredDirection: 'B', ratingsEaseB: 5, likedMost: 'The hybrid flow' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('survey-1');
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ preferredDirection: 'B' }));
  });

  it('400s with flattened zod details for an invalid direction', async () => {
    const res = await request(app)
      .post('/survey/design-review')
      .send({ preferredDirection: 'Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid survey data');
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('400 details keep the flattened { formErrors, fieldErrors } shape (API contract across zod 3→4)', async () => {
    const res = await request(app)
      .post('/survey/design-review')
      .send({ preferredDirection: 'Z' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({
      formErrors: [],
      fieldErrors: { preferredDirection: [expect.any(String)] },
    });
  });

  it('caps free-text fields (2000 chars) — oversize input is rejected, not truncated', async () => {
    const res = await request(app)
      .post('/survey/design-review')
      .send({ preferredDirection: 'A', concerns: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });
});

describe('POST /survey/comments', () => {
  it('saves a review comment', async () => {
    const insertValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'c1', direction: 'B', comment: 'Love it' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

    const res = await request(app)
      .post('/survey/comments')
      .send({ direction: 'B', comment: 'Love it', stepNumber: 3 });

    expect(res.status).toBe(201);
    expect(res.body.comment).toBe('Love it');
  });

  it('rejects an empty comment', async () => {
    const res = await request(app)
      .post('/survey/comments')
      .send({ direction: 'B', comment: '' });

    expect(res.status).toBe(400);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });
});

describe('GET /survey/comments/:direction', () => {
  it('lists comments for a direction newest-first', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([{ id: 'c1', direction: 'B', comment: 'Love it' }]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get('/survey/comments/B');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].direction).toBe('B');
  });
});
