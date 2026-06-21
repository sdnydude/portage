import { db } from '../db/index.js';
import { encrypt, decrypt } from '../lib/crypto.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/crypto.js', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

// Set eBay credentials in env before any imports that read env
process.env.EBAY_CLIENT_ID = 'test-ebay-client-id';
process.env.EBAY_CLIENT_SECRET = 'test-ebay-client-secret';
process.env.EBAY_PROD_CLIENT_ID = 'test-ebay-prod-client-id';
process.env.EBAY_PROD_CLIENT_SECRET = 'test-ebay-prod-client-secret';

// Import after mocks and env are in place
import {
  getEbayAccessToken,
  getEbayAppToken,
  getEbayProdAppToken,
  invalidateEbayAppToken,
  invalidateEbayProdAppToken,
} from './token-manager.js';

const MOCK_TOKEN = 'decrypted-access-token';
const MOCK_NEW_TOKEN = 'fresh-access-token';

function mockSelectReturnsAccount(account: unknown) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(account ? [account] : []),
      }),
    }),
  } as any);
}

function mockUpdateSets() {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any);
}

function mockFetch(data: unknown, ok = true, status?: number, bodyText?: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: status ?? (ok ? 200 : 401),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(bodyText ?? (ok ? '' : 'Unauthorized')),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  invalidateEbayAppToken();
  invalidateEbayProdAppToken();
  vi.mocked(encrypt).mockReturnValue('encrypted-token');
  vi.mocked(decrypt).mockReturnValue(MOCK_TOKEN);
});

describe('getEbayAccessToken', () => {
  it('returns decrypted token when not expired', async () => {
    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now
    mockSelectReturnsAccount({
      id: 'account-1',
      userId: 'user-1',
      marketplace: 'ebay',
      accessTokenEncrypted: 'encrypted-access',
      refreshTokenEncrypted: 'encrypted-refresh',
      tokenExpiresAt: futureExpiry,
    });
    const fetchMock = mockFetch({});

    const token = await getEbayAccessToken('user-1');
    expect(token).toBe(MOCK_TOKEN);
    expect(vi.mocked(decrypt)).toHaveBeenCalledWith('encrypted-access');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes and returns new token when expired', async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
    mockSelectReturnsAccount({
      id: 'account-1',
      userId: 'user-1',
      marketplace: 'ebay',
      accessTokenEncrypted: 'encrypted-old',
      refreshTokenEncrypted: 'encrypted-refresh',
      tokenExpiresAt: pastExpiry,
    });
    mockUpdateSets();
    // decrypt is called for refresh token during refresh
    vi.mocked(decrypt).mockReturnValueOnce('decrypted-refresh-token');
    const fetchMock = mockFetch({ access_token: MOCK_NEW_TOKEN, expires_in: 7200 });

    const token = await getEbayAccessToken('user-1');
    expect(token).toBe(MOCK_NEW_TOKEN);
    expect(vi.mocked(encrypt)).toHaveBeenCalledWith(MOCK_NEW_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws typed EBAY_SETUP_REQUIRED (400) when no eBay account is connected', async () => {
    mockSelectReturnsAccount(null);

    await expect(getEbayAccessToken('user-with-no-account'))
      .rejects.toMatchObject({ code: 'EBAY_SETUP_REQUIRED', statusCode: 400 });
  });

  it('throws typed EBAY_RECONNECT_REQUIRED (409) when refresh token is invalid_grant (revoked/locked)', async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    mockSelectReturnsAccount({
      id: 'account-1',
      userId: 'user-1',
      marketplace: 'ebay',
      accessTokenEncrypted: 'encrypted-old',
      refreshTokenEncrypted: 'encrypted-refresh',
      tokenExpiresAt: pastExpiry,
    });
    vi.mocked(decrypt).mockReturnValueOnce('decrypted-refresh-token');
    mockFetch({}, false, 400, JSON.stringify({
      error: 'invalid_grant',
      error_description: 'the provided authorization refresh token is invalid or was issued to another client',
    }));

    await expect(getEbayAccessToken('user-1'))
      .rejects.toMatchObject({ code: 'EBAY_RECONNECT_REQUIRED', statusCode: 409 });
  });

  it('throws typed EBAY_UNAVAILABLE (502) when refresh fails for a transient reason', async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    mockSelectReturnsAccount({
      id: 'account-1',
      userId: 'user-1',
      marketplace: 'ebay',
      accessTokenEncrypted: 'encrypted-old',
      refreshTokenEncrypted: 'encrypted-refresh',
      tokenExpiresAt: pastExpiry,
    });
    vi.mocked(decrypt).mockReturnValueOnce('decrypted-refresh-token');
    mockFetch({}, false, 503, 'Service Unavailable');

    await expect(getEbayAccessToken('user-1'))
      .rejects.toMatchObject({ code: 'EBAY_UNAVAILABLE', statusCode: 502 });
  });
});

describe('getEbayAppToken', () => {
  it('fetches a new token on cache miss', async () => {
    const fetchMock = mockFetch({ access_token: 'app-token-fresh', expires_in: 7200 });

    const token = await getEbayAppToken();
    expect(token).toBe('app-token-fresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns cached token on cache hit without calling fetch again', async () => {
    const fetchMock = mockFetch({ access_token: 'app-token-cached', expires_in: 7200 });

    // First call — populates cache
    await getEbayAppToken();
    // Second call — should hit cache
    const token = await getEbayAppToken();
    expect(token).toBe('app-token-cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh token after invalidation', async () => {
    const fetchMock = mockFetch({ access_token: 'token-v1', expires_in: 7200 });
    await getEbayAppToken();

    invalidateEbayAppToken();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'token-v2', expires_in: 7200 }),
      text: vi.fn().mockResolvedValue(''),
    });

    const token = await getEbayAppToken();
    expect(token).toBe('token-v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when fetch returns non-OK response', async () => {
    mockFetch({}, false);

    await expect(getEbayAppToken()).rejects.toThrow('Failed to get eBay app token');
  });
});

describe('getEbayProdAppToken', () => {
  it('fetches and caches a prod app token independently from sandbox token', async () => {
    const fetchMock = mockFetch({ access_token: 'prod-app-token', expires_in: 7200 });

    const token = await getEbayProdAppToken();
    expect(token).toBe('prod-app-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateEbayProdAppToken', () => {
  it('clears prod cache so next call fetches fresh token', async () => {
    const fetchMock = mockFetch({ access_token: 'prod-token-v1', expires_in: 7200 });
    await getEbayProdAppToken();

    invalidateEbayProdAppToken();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'prod-token-v2', expires_in: 7200 }),
      text: vi.fn().mockResolvedValue(''),
    });

    const token = await getEbayProdAppToken();
    expect(token).toBe('prod-token-v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
