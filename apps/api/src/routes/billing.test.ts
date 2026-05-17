import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const mockStripeInstance = {
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
    },
  },
  subscriptions: {
    retrieve: vi.fn().mockResolvedValue({ items: { data: [{ price: { id: 'price_monthly_test' } }] } }),
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation(() => {
      throw new Error('Invalid signature');
    }),
  },
};

vi.mock('stripe', () => {
  return { default: vi.fn(() => mockStripeInstance) };
});

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';
  process.env.STRIPE_PRICE_ANNUAL = 'price_annual_test';
  process.env.STRIPE_PRICE_CREDITS = 'price_credits_test';
  process.env.STRIPE_PORTAL_CONFIG = 'bpc_test_fake';
  app = createApp();
  token = createTestToken({ tier: 'free' });
});

function mockUserWithStripe(overrides: Record<string, unknown> = {}) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{
          id: 'test-user-id',
          email: 'test@example.com',
          subscriptionTier: 'free',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
          aiListingsThisMonth: 3,
          aiListingCredits: 0,
          ...overrides,
        }]),
      }),
    }),
  } as any);
}

describe('POST /billing/create-checkout', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/billing/create-checkout').send({ plan: 'monthly' });
    expect(res.status).toBe(401);
  });

  it('returns checkout URL for monthly plan', async () => {
    mockUserWithStripe();
    const res = await request(app)
      .post('/billing/create-checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'monthly' });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
  });

  it('returns checkout URL for annual plan', async () => {
    mockUserWithStripe();
    const res = await request(app)
      .post('/billing/create-checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'annual' });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
  });

  it('rejects invalid plan', async () => {
    mockUserWithStripe();
    const res = await request(app)
      .post('/billing/create-checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'invalid' });
    expect(res.status).toBe(400);
  });
});

describe('POST /billing/create-portal', () => {
  it('returns portal URL for subscriber', async () => {
    mockUserWithStripe({ stripeCustomerId: 'cus_test123' });
    const res = await request(app)
      .post('/billing/create-portal')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('billing.stripe.com');
  });

  it('returns 400 if no stripe customer', async () => {
    mockUserWithStripe({ stripeCustomerId: null });
    const res = await request(app)
      .post('/billing/create-portal')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /billing/buy-credits', () => {
  it('returns checkout URL for credit pack', async () => {
    mockUserWithStripe();
    const res = await request(app)
      .post('/billing/buy-credits')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
  });
});

describe('POST /billing/webhook', () => {
  it('returns 400 for invalid signature', async () => {
    const res = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'bad_sig')
      .set('content-type', 'application/json')
      .send('{"type":"test"}');
    expect(res.status).toBe(400);
  });
});
