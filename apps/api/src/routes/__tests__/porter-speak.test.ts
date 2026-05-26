import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

import { db } from '../../db/index.js';

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.resetAllMocks();
});

function mockUserSelect() {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 }]),
      }),
    }),
  } as never);
}

describe('POST /porter/speak', () => {
  it('forwards text to dhg-tts and streams audio back', async () => {
    process.env.DHG_TTS_URL = 'http://dhg-tts:8000';

    const audioBytes = Buffer.from([0x49, 0x44, 0x33]); // ID3 header
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(audioBytes);
          controller.close();
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      mockUserSelect();
      const res = await request(app)
        .post('/porter/speak')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello from Porter' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio/);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/audio/speech');
      const body = JSON.parse(calledOpts.body as string);
      expect(body.input).toBe('Hello from Porter');
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_TTS_URL;
    }
  });

  it('returns 503 when dhg-tts is unreachable', async () => {
    process.env.DHG_TTS_URL = 'http://dhg-tts:8000';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    try {
      mockUserSelect();
      const res = await request(app)
        .post('/porter/speak')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ error: 'TTS unavailable' });
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_TTS_URL;
    }
  });

  it('returns 503 when dhg-tts responds with error status', async () => {
    process.env.DHG_TTS_URL = 'http://dhg-tts:8000';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({}),
    }));

    try {
      mockUserSelect();
      const res = await request(app)
        .post('/porter/speak')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ error: 'TTS unavailable' });
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_TTS_URL;
    }
  });
});
