import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('POST /beta/report', () => {
  it('forwards the report to the registry with server-side reporter identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'br-1', status: 'open' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/beta/report')
      .set('Authorization', `Bearer ${token}`)
      .send({
        page: '/inventory',
        area: 'inventory',
        severity: 'medium',
        description: 'Item grid flickers when scrolling fast',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('br-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/beta-reports');
    const posted = JSON.parse(init.body);
    expect(posted.project_name).toBe('portage');
    expect(posted.reporter_email).toBe('test@example.com');
    expect(posted.reporter_user_id).toBe('test-user-id');
    expect(posted.page).toBe('/inventory');
    expect(posted.severity).toBe('medium');
  });

  it('returns 502 REGISTRY_UNAVAILABLE when the registry is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    const res = await request(app)
      .post('/beta/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ page: '/home', severity: 'low', description: 'x' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('REGISTRY_UNAVAILABLE');
  });
});
