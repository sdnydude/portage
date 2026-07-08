import { jwtVerify } from 'jose';
import { verifyCfAccessJwt } from './cf-access.js';
import { loadEnv, resetEnv } from './env.js';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue('jwks-sentinel'),
  jwtVerify: vi.fn(),
}));

afterEach(() => {
  delete process.env.CF_ACCESS_AUD;
  resetEnv();
  loadEnv();
});

describe('verifyCfAccessJwt', () => {
  it('throws a config error when CF_ACCESS_AUD is not set', async () => {
    // Pin an empty value: the developer .env may carry a real CF_ACCESS_AUD
    // (Doppler-synced), and dotenv never overrides existing process.env.
    process.env.CF_ACCESS_AUD = '';
    resetEnv();
    loadEnv();
    await expect(verifyCfAccessJwt('any-token')).rejects.toThrow('CF_ACCESS_AUD is not configured');
  });

  it('verifies against the team JWKS with issuer + audience and maps the identity', async () => {
    process.env.CF_ACCESS_AUD = 'aud-123';
    resetEnv();
    loadEnv();
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'Tester@Example.com', common_name: 'svc-cn' },
    } as any);

    const identity = await verifyCfAccessJwt('the-token');

    expect(jwtVerify).toHaveBeenCalledWith('the-token', 'jwks-sentinel', {
      issuer: 'https://digitalharmonyai.cloudflareaccess.com',
      audience: ['aud-123'],
    });
    expect(identity).toEqual({ email: 'Tester@Example.com', commonName: 'svc-cn' });
  });

  it('accepts a comma-separated CF_ACCESS_AUD (web app + API app audiences)', async () => {
    process.env.CF_ACCESS_AUD = 'aud-web, aud-api';
    resetEnv();
    loadEnv();
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { email: 'x@y.com' } } as any);

    await verifyCfAccessJwt('tok');

    expect(jwtVerify).toHaveBeenCalledWith('tok', 'jwks-sentinel', {
      issuer: 'https://digitalharmonyai.cloudflareaccess.com',
      audience: ['aud-web', 'aud-api'],
    });
  });
});
