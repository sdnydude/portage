import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { createApp } from '../../app.js';
import { resetEnv, loadEnv } from '../../lib/env.js';
import { anonymizeEbayIdentity } from '../../marketplace/ebay-deletion-anonymize.js';
import { verifyNotificationSignature } from '../../marketplace/ebay-notification-verify.js';
import { ebayDeletionNotifications } from '../../lib/metrics.js';

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));
vi.mock('../../marketplace/ebay-deletion-anonymize.js', () => ({
  anonymizeEbayIdentity: vi.fn(),
}));
vi.mock('../../marketplace/ebay-notification-verify.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../marketplace/ebay-notification-verify.js')>();
  return { ...actual, verifyNotificationSignature: vi.fn() };
});

const TOKEN = 'v'.repeat(40);
const ENDPOINT = 'https://portage-api.digitalharmonyai.com/marketplace/ebay/account-deletion';
const PATH = '/marketplace/ebay/account-deletion';

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.EBAY_DELETION_VERIFICATION_TOKEN = TOKEN;
  process.env.EBAY_DELETION_ENDPOINT_URL = ENDPOINT;
  resetEnv();
  loadEnv();
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /marketplace/ebay/account-deletion (challenge)', () => {
  it('returns 400 when challenge_code is missing', async () => {
    const res = await request(app).get(PATH);
    expect(res.status).toBe(400);
  });

  it('answers eBay\'s challenge unauthenticated with 200 application/json {challengeResponse: sha256hex(code+token+endpoint)}', async () => {
    const code = '71745723-d031-455c-bfa5-f90d11b4f20a';
    const expected = createHash('sha256').update(code).update(TOKEN).update(ENDPOINT).digest('hex');
    const res = await request(app).get(PATH).query({ challenge_code: code });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ challengeResponse: expected });
  });
});

const NOTIFICATION = {
  metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
  notification: {
    notificationId: 'n-1',
    eventDate: '2026-08-19T00:00:00Z',
    publishDate: '2026-08-19T00:00:00Z',
    publishAttemptCount: 1,
    data: { username: 'gone_buyer', userId: 'GONEID', eiasToken: 'x' },
  },
};

async function counterValue(result: string): Promise<number> {
  const { values } = await ebayDeletionNotifications.get();
  return values.find((v) => v.labels.result === result)?.value ?? 0;
}

describe('POST /marketplace/ebay/account-deletion (notification)', () => {
  it('returns 412 and does NOT touch the anonymizer when the signature is missing/invalid', async () => {
    vi.mocked(verifyNotificationSignature).mockResolvedValue('invalid');
    const before = await counterValue('invalid_sig');

    const res = await request(app).post(PATH).set('Content-Type', 'application/json').send(NOTIFICATION);

    expect(res.status).toBe(412);
    expect(anonymizeEbayIdentity).not.toHaveBeenCalled();
    expect(await counterValue('invalid_sig')).toBe(before + 1);
  });

  it('anonymizes SYNCHRONOUSLY on a valid signature, then acks 204 and counts the outcome', async () => {
    vi.mocked(verifyNotificationSignature).mockResolvedValue('ok');
    vi.mocked(anonymizeEbayIdentity).mockResolvedValue({ outcome: 'ok', counts: { accounts: 1, orders: 2, messages: 0, notifications: 0 } });
    const before = await counterValue('ok');

    const res = await request(app).post(PATH).set('Content-Type', 'application/json').send(NOTIFICATION);

    expect(res.status).toBe(204);
    expect(anonymizeEbayIdentity).toHaveBeenCalledWith(NOTIFICATION.notification.data, 'n-1');
    expect(await counterValue('ok')).toBe(before + 1);
    // Verifier received the raw bytes + the header we sent
    const [rawArg] = vi.mocked(verifyNotificationSignature).mock.calls[0];
    expect(JSON.parse(rawArg.toString('utf8'))).toEqual(NOTIFICATION);
  });

  it('acks non-deletion topics with 204 without processing, answers 503 when the public key is unavailable, and 500 when the DB write fails (eBay retries both)', async () => {
    vi.mocked(verifyNotificationSignature).mockResolvedValue('ok');
    const otherTopic = { ...NOTIFICATION, metadata: { ...NOTIFICATION.metadata, topic: 'PRIORITY_LISTING_REVISION' } };
    const ignoredBefore = await counterValue('ignored_topic');
    const ignored = await request(app).post(PATH).set('Content-Type', 'application/json').send(otherTopic);
    expect(ignored.status).toBe(204);
    expect(anonymizeEbayIdentity).not.toHaveBeenCalled();
    expect(await counterValue('ignored_topic')).toBe(ignoredBefore + 1);

    vi.mocked(verifyNotificationSignature).mockResolvedValue('key_unavailable');
    const keyBefore = await counterValue('key_unavailable');
    const unavailable = await request(app).post(PATH).set('Content-Type', 'application/json').send(NOTIFICATION);
    expect(unavailable.status).toBe(503);
    expect(anonymizeEbayIdentity).not.toHaveBeenCalled();
    expect(await counterValue('key_unavailable')).toBe(keyBefore + 1);

    vi.mocked(verifyNotificationSignature).mockResolvedValue('ok');
    vi.mocked(anonymizeEbayIdentity).mockRejectedValue(new Error('db down'));
    const errorBefore = await counterValue('db_error');
    const failed = await request(app).post(PATH).set('Content-Type', 'application/json').send(NOTIFICATION);
    expect(failed.status).toBe(500);
    expect(await counterValue('db_error')).toBe(errorBefore + 1);
  });

  it('rejects bodies over 100kb with 413 regardless of content-type, before any signature work', async () => {
    vi.mocked(verifyNotificationSignature).mockResolvedValue('ok');
    const big = 'x'.repeat(101 * 1024);
    const asJson = await request(app).post(PATH).set('Content-Type', 'application/json').send(big);
    expect(asJson.status).toBe(413);
    const tooLargeBefore = await counterValue('payload_too_large');
    const asText = await request(app).post(PATH).set('Content-Type', 'text/plain').send(big);
    expect(asText.status).toBe(413);
    expect(verifyNotificationSignature).not.toHaveBeenCalled();
    expect(await counterValue('payload_too_large')).toBe(tooLargeBefore + 1);
  });

  it('rate-limits per cf-connecting-ip (60/min) and per raw ip (300/min) so neither eBay nor a LAN spoofer can flood it', async () => {
    // Test-mode limits mirror prod (this suite runs on a fresh app per file).
    vi.mocked(verifyNotificationSignature).mockResolvedValue('invalid');
    let last = 0;
    for (let i = 0; i < 61; i++) {
      const r = await request(app).post(PATH).set('Content-Type', 'application/json').set('cf-connecting-ip', '203.0.113.9').send(NOTIFICATION);
      last = r.status;
    }
    expect(last).toBe(429);
    // A different edge IP is a fresh tier-2 bucket…
    const other = await request(app).post(PATH).set('Content-Type', 'application/json').set('cf-connecting-ip', '203.0.113.10').send(NOTIFICATION);
    expect(other.status).toBe(412);
    // …but tier-1 (raw socket ip, all requests here) still caps at 300 total.
    let tier1 = 0;
    for (let i = 0; i < 300; i++) {
      const r = await request(app).post(PATH).set('Content-Type', 'application/json').set('cf-connecting-ip', `198.51.100.${i % 200}`).send(NOTIFICATION);
      tier1 = r.status;
    }
    expect(tier1).toBe(429);
  });
});

describe('mount isolation', () => {
  it('leaves the sibling /marketplace/ebay/* routes auth-gated (public mount is path-exact)', async () => {
    const status = await request(app).get('/marketplace/ebay/status');
    expect(status.status).toBe(401);
    const connect = await request(app).get('/marketplace/ebay/connect');
    expect(connect.status).toBe(401);
  });
});
