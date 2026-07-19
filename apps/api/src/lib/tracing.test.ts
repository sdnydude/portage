import { traceRequest, traceTool, traceStep } from './tracing.js';

describe('traceStep', () => {
  it('returns the step result', async () => {
    expect(await traceStep('prefill-aspects', async () => ['Brand', 'Model'])).toEqual(['Brand', 'Model']);
  });
});

describe('traceTool', () => {
  it('returns the tool result', async () => {
    const result = await traceTool('search_inventory', { query: 'guitar' }, async () => ({ count: 3 }));
    expect(result).toEqual({ count: 3 });
  });
});

vi.mock('@langfuse/tracing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@langfuse/tracing')>();
  return {
    ...actual,
    startActiveObservation: vi.fn(actual.startActiveObservation),
    setActiveTraceIO: vi.fn(actual.setActiveTraceIO),
  };
});

describe('trace-level attributes', () => {
  it('publishes input and output to the trace, not just the root span', async () => {
    const { setActiveTraceIO } = await import('@langfuse/tracing');
    vi.mocked(setActiveTraceIO).mockClear();

    await traceRequest('porter-chat-turn', { userId: 'u1', input: 'hello' }, async () => 'hi there');

    expect(vi.mocked(setActiveTraceIO)).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'hello', output: 'hi there' }),
    );
  });
});

describe('traceRequest', () => {
  it('records the handler result as the trace output', async () => {
    const updates: unknown[] = [];
    const { startActiveObservation } = await import('@langfuse/tracing');
    vi.mocked(startActiveObservation).mockImplementationOnce(
      (async (_name: string, fn: (span: unknown) => Promise<unknown>) =>
        fn({ update: (patch: unknown) => updates.push(patch) })) as never,
    );

    await traceRequest('porter-chat-turn', { userId: 'u1', input: 'what is my inventory worth?' }, async () => 'About $4,200.');

    expect(updates).toContainEqual({ output: 'About $4,200.' });
  });

  it('returns the wrapped handler result', async () => {
    const result = await traceRequest('scan-item', { userId: 'u1' }, async () => 'identified');
    expect(result).toBe('identified');
  });

  it('propagates handler errors instead of swallowing them', async () => {
    const boom = new Error('vision provider chain exhausted');
    await expect(
      traceRequest('scan-item', { userId: 'u1' }, async () => {
        throw boom;
      }),
    ).rejects.toThrow('vision provider chain exhausted');
  });
});
