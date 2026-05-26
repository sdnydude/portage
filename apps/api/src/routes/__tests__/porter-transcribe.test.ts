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

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /porter/transcribe', () => {
  it('sends audio buffer as multipart file to dhg-stt', async () => {
    process.env.DHG_STT_URL = 'http://dhg-stt:8000';

    let capturedFormData: FormData | undefined;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
      capturedFormData = opts.body as FormData;
      return { ok: true, json: async () => ({ text: 'test', duration: 1 }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const audioBuffer = Buffer.from('real-audio-bytes');
      await request(app)
        .post('/porter/transcribe')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', audioBuffer, { filename: 'rec.webm', contentType: 'audio/webm' });

      expect(capturedFormData).toBeInstanceOf(FormData);
      const file = capturedFormData!.get('file');
      expect(file).toBeInstanceOf(Blob);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_STT_URL;
    }
  });

  it('includes uploaded audio bytes in FormData sent to dhg-stt', async () => {
    process.env.DHG_STT_URL = 'http://dhg-stt:8000';

    let capturedBlob: Blob | undefined;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
      const fd = opts.body as FormData;
      capturedBlob = fd?.get('file') as Blob;
      return { ok: true, json: async () => ({ text: 'ok', duration: 0.5 }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const audioBytes = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      await request(app)
        .post('/porter/transcribe')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', audioBytes, { filename: 'clip.webm', contentType: 'audio/webm' });

      expect(capturedBlob).toBeInstanceOf(Blob);
      expect(capturedBlob!.size).toBeGreaterThan(0);
      const bytes = await capturedBlob!.arrayBuffer();
      expect(new Uint8Array(bytes)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_STT_URL;
    }
  });

  it('forwards audio to dhg-stt and returns transcript', async () => {
    process.env.DHG_STT_URL = 'http://dhg-stt:8000';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello Porter, how are you?', duration: 2.1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const audioBuffer = Buffer.from('fake-audio-data');

      const res = await request(app)
        .post('/porter/transcribe')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', audioBuffer, { filename: 'recording.webm', contentType: 'audio/webm' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ text: 'Hello Porter, how are you?', duration: 2.1 });
      expect(fetchMock).toHaveBeenCalledOnce();

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('/v1/audio/transcriptions');
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_STT_URL;
    }
  });
});
