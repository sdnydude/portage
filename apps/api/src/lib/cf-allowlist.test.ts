import { getAllowlist, addEmail, removeEmail } from './cf-allowlist.js';
import { loadEnv, resetEnv } from './env.js';

beforeEach(() => {
  process.env.CF_API_TOKEN = 'cf-token';
  process.env.CF_ACCOUNT_ID = 'acct-1';
  process.env.CF_ACCESS_APP_IDS = 'app-web,app-api';
  resetEnv();
  loadEnv();
});

afterEach(() => {
  delete process.env.CF_API_TOKEN;
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_ACCESS_APP_IDS;
  resetEnv();
  loadEnv();
  vi.restoreAllMocks();
});

function policiesResponse(emails: string[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      result: [
        {
          id: 'pol-1',
          name: 'Beta allowlist',
          decision: 'allow',
          include: emails.map((e) => ({ email: { email: e } })),
        },
      ],
    }),
  };
}

describe('getAllowlist', () => {
  it('reads the allow policy of the first Access app and returns its emails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(policiesResponse(['a@x.com', 'b@y.com']));
    vi.stubGlobal('fetch', fetchMock);

    const emails = await getAllowlist();

    expect(emails).toEqual(['a@x.com', 'b@y.com']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/accounts/acct-1/access/apps/app-web/policies');
  });
});

describe('addEmail', () => {
  it('PUTs the allow policy of every configured app with the email appended', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) };
      }
      return policiesResponse(['a@x.com']);
    });
    vi.stubGlobal('fetch', fetchMock);

    await addEmail('New@Tester.com');

    const puts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');
    expect(puts.length).toBe(2);
    expect(String(puts[0][0])).toContain('/access/apps/app-web/policies/pol-1');
    expect(String(puts[1][0])).toContain('/access/apps/app-api/policies/pol-1');
    const body = JSON.parse((puts[0][1] as RequestInit).body as string);
    expect(body.include).toEqual([
      { email: { email: 'a@x.com' } },
      { email: { email: 'new@tester.com' } },
    ]);
    expect(body.decision).toBe('allow');
  });
});

describe('removeEmail', () => {
  it('PUTs every app policy without the removed email (case-insensitive)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) };
      }
      return policiesResponse(['a@x.com', 'gone@y.com']);
    });
    vi.stubGlobal('fetch', fetchMock);

    const remaining = await removeEmail('Gone@Y.com');

    expect(remaining).toEqual(['a@x.com']);
    const puts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');
    expect(puts.length).toBe(2);
    const body = JSON.parse((puts[0][1] as RequestInit).body as string);
    expect(body.include).toEqual([{ email: { email: 'a@x.com' } }]);
  });
});
