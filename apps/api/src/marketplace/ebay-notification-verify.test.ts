import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  challengeResponse,
  parseSignatureHeader,
  verifyNotificationSignature,
  _resetEbayNotificationKeyCache,
} from './ebay-notification-verify.js';

vi.mock('./token-manager.js', () => ({
  getEbayProdAppToken: vi.fn(async () => 'app-token'),
}));

const VALID_MESSAGE = {
  metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
  notification: {
    notificationId: '49feeaeb-4982-42d9-a377-9645b8479411_33f7e043-fed8-442b-9d44-791923bd9a6d',
    eventDate: '2021-03-19T20:43:59.462Z',
    publishDate: '2021-03-19T20:43:59.679Z',
    publishAttemptCount: 1,
    data: { username: 'test_user', userId: 'ma8vp1jySJC', eiasToken: 'nY+sHZ2PrBmdj6wVnY+sEZ2PrA2dj6wJnY+gAZGEpwmdj6x9nY+seQ==' },
  },
};
const VALID_KEY_RESPONSE = {
  key: '-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZhhxXKtR+TOvtDbgTPCkSof02qgBB7IsYOyf76ilExJ/upAa/vKIKheOoCyOpcLmi4t0b4uepb7LLjmMr90FUg==-----END PUBLIC KEY-----',
  algorithm: 'ECDSA',
  digest: 'SHA1',
};

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function mockKeyFetch(status = 200, body: unknown = VALID_KEY_RESPONSE) {
  fetchMock.mockResolvedValue({ ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) });
}

beforeEach(() => {
  fetchMock.mockReset();
  _resetEbayNotificationKeyCache();
});

describe('challengeResponse', () => {
  it('hashes challengeCode + verificationToken + endpoint (sha256 hex) in eBay order', () => {
    // eBay guide: "hash the challenge code, verification token, and endpoint URL
    // ... in the following order: challengeCode + verificationToken + endpoint".
    const code = '71745723-d031-455c-bfa5-f90d11b4f20a';
    const token = 'v'.repeat(40);
    const endpoint = 'https://portage-api.digitalharmonyai.com/marketplace/ebay/account-deletion';
    const expected = createHash('sha256').update(code).update(token).update(endpoint).digest('hex');
    expect(challengeResponse(code, token, endpoint)).toBe(expected);
  });
});

// Vectors from eBay's official event-notification-nodejs-sdk test/test.json (VALID / SIGNATURE_MISMATCH).
const VALID_SIG = 'eyJhbGciOiJlY2RzYSIsImtpZCI6Ijk5MzYyNjFhLTdkN2ItNDYyMS1hMGYxLTk2Y2NiNDI4YWY0OSIsInNpZ25hdHVyZSI6Ik1FWUNJUUNmeGZJV3V4bVdjSUJRSjljNS9YN2lHREpxczJSQ0dzQkVhQWppbnlycmZBSWhBSVY2d0djVGlCdVY1S0pVaWYyaG9reXJMK1E5c3NIa2FkK214Mm5FRTI1dyIsImRpZ2VzdCI6IlNIQTEifQ==';
const VALID_KID = '9936261a-7d7b-4621-a0f1-96ccb428af49';

describe('parseSignatureHeader', () => {
  it('base64-decodes the JSON header and returns kid + signature for a valid eBay header', () => {
    expect(parseSignatureHeader(VALID_SIG)).toEqual({
      alg: 'ecdsa',
      kid: VALID_KID,
      signature: 'MEYCIQCfxfIWuxmWcIBQJ9c5/X7iGDJqs2RCGsBEaAjinyrrfAIhAIV6wGcTiBuV5KJUif2hokyrL+Q9ssHkad+mx2nEE25w',
      digest: 'SHA1',
    });
  });

  it('returns null for missing, non-base64-JSON, or kid/signature-less headers', () => {
    expect(parseSignatureHeader(undefined)).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
    expect(parseSignatureHeader('not-base64-json!!')).toBeNull();
    expect(parseSignatureHeader(Buffer.from('"just a string"').toString('base64'))).toBeNull();
    expect(parseSignatureHeader(Buffer.from(JSON.stringify({ kid: 'k' })).toString('base64'))).toBeNull();
  });
});

describe('verifyNotificationSignature', () => {
  it("returns 'ok' for eBay's VALID vector (ECDSA-SHA1 over the JSON body) after fetching the kid's public key", async () => {
    mockKeyFetch();
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE));
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.ebay.com/commerce/notification/v1/public_key/${VALID_KID}`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer app-token');
  });

  it("falls back to the SDK-canonical JSON.stringify(body) when the raw bytes differ (pretty-printed body)", async () => {
    mockKeyFetch();
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE, null, 2));
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('ok');
  });

  it("returns 'invalid' for eBay's SIGNATURE_MISMATCH vector and for a tampered body", async () => {
    mockKeyFetch();
    const MISMATCH_SIG = 'eyJhbGciOiJlY2RzYSIsImtpZCI6Ijk5MzYyNjFhLTdkN2ItNDYyMS1hMGYxLTk2Y2NiNDI4YWY0OSIsInNpZ25hdHVyZSI6Ik1FVUNJUUNHY1NubUFrVGZyK1paMlZnMGJXRW9zOGEvdGVCcWk3UGU2OCtoR21MTUNRSWdlRnZrcnRvKzhkczhSVndJM0dnbjFtTUdDck5NRVpKM1NSbE8yZngveHFJPSIsImRpZ2VzdCI6IlNIQTEifQ==';
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE));
    await expect(verifyNotificationSignature(raw, MISMATCH_SIG)).resolves.toBe('invalid');
    const tampered = Buffer.from(JSON.stringify({ ...VALID_MESSAGE, notification: { ...VALID_MESSAGE.notification, data: { username: 'someone_else' } } }));
    await expect(verifyNotificationSignature(tampered, VALID_SIG)).resolves.toBe('invalid');
  });

  it("rejects wrong alg/digest, non-UUID kid, and unparseable bodies as 'invalid' WITHOUT any key fetch", async () => {
    mockKeyFetch();
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE));
    const base = parseSignatureHeader(VALID_SIG)!;
    await expect(verifyNotificationSignature(raw, enc({ ...base, alg: 'rsa' }))).resolves.toBe('invalid');
    await expect(verifyNotificationSignature(raw, enc({ ...base, digest: 'SHA256' }))).resolves.toBe('invalid');
    await expect(verifyNotificationSignature(raw, enc({ ...base, kid: '../oauth2/token' }))).resolves.toBe('invalid');
    await expect(verifyNotificationSignature(Buffer.from('{not json'), VALID_SIG)).resolves.toBe('invalid');
    await expect(verifyNotificationSignature(raw, undefined)).resolves.toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 'key_unavailable' when eBay's key endpoint fails, negative-caches it, and positive-caches a good key (one fetch for two calls)", async () => {
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE));
    mockKeyFetch(500, { errors: [{ message: 'boom' }] });
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('key_unavailable');
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('key_unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1); // negative cache absorbed the second

    _resetEbayNotificationKeyCache();
    mockKeyFetch();
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('ok');
    await expect(verifyNotificationSignature(raw, VALID_SIG)).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 (failed, above) + 1 positive; second ok call served from cache
  });

  it('caps new-kid public-key fetches at 10 per minute regardless of the HTTP rate limiter', async () => {
    mockKeyFetch(404, {});
    const raw = Buffer.from(JSON.stringify(VALID_MESSAGE));
    const base = parseSignatureHeader(VALID_SIG)!;
    for (let i = 0; i < 11; i++) {
      const kid = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
      const header = Buffer.from(JSON.stringify({ ...base, kid })).toString('base64');
      await expect(verifyNotificationSignature(raw, header)).resolves.toBe('key_unavailable');
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
