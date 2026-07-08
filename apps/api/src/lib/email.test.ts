import { sendBetaInvite } from './email.js';
import { loadEnv, resetEnv } from './env.js';

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_FROM = 'Portage Beta <beta@beta.digitalharmonyai.com>';
  process.env.APP_URL = 'https://portage.digitalharmonyai.com';
  resetEnv();
  loadEnv();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.APP_URL;
  resetEnv();
  loadEnv();
  vi.restoreAllMocks();
});

describe('sendBetaInvite', () => {
  it('POSTs a Resend email to the invitee with the app login link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'email-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendBetaInvite('New@Tester.com');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.from).toBe('Portage Beta <beta@beta.digitalharmonyai.com>');
    expect(body.to).toEqual(['New@Tester.com']);
    expect(body.subject).toContain('Portage');
    expect(body.html).toContain('https://portage.digitalharmonyai.com');
  });
});
