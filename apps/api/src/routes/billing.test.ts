import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';
import { billingRateLimitKey } from './billing.js';

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
  return { default: vi.fn(function () { return mockStripeInstance; }) };
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

  it('returns duplicate:true for already-processed event', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce({
      id: 'evt_already_processed',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_test' } },
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const res = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('content-type', 'application/json')
      .send(Buffer.from('{"type":"invoice.payment_failed"}'));
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });
});

describe('billingRateLimitKey', () => {
  it('normalizes an IPv6 address to a subnet for anonymous callers (no raw-IPv6 limit bypass)', () => {
    const raw = '2001:db8:85a3:8d3:1319:8a2e:370:7344';
    const key = billingRateLimitKey({ ip: raw } as any);
    expect(key).not.toBe(raw); // must be a normalized subnet, not the raw address
    expect(key.startsWith('2001:db8')).toBe(true); // network prefix retained
  });

  it('keys an authenticated caller on the user id, never the IP', () => {
    expect(billingRateLimitKey({ user: { sub: 'user-42' }, ip: '2001:db8::1' } as any)).toBe('user-42');
  });
});
