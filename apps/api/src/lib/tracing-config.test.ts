import { tracingEnabled, maskTraceData, scrubSpanAttributes } from './tracing-config.js';

describe('scrubSpanAttributes', () => {
  it('masks base64 payloads in raw OTel attributes written by third-party instrumentation', () => {
    // OpenInference writes its own attribute keys, which Langfuse's own `mask`
    // hook never sees — so photos leaked into exported spans until this ran.
    const photo = 'B'.repeat(3000);
    const attributes: Record<string, unknown> = {
      'llm.input_messages.0.message.contents.0.image.image.url': `data:image/jpeg;base64,${photo}`,
      'llm.model_name': 'claude-sonnet-4-6',
    };

    scrubSpanAttributes(attributes);

    expect(JSON.stringify(attributes)).not.toContain(photo);
    expect(attributes['llm.model_name']).toBe('claude-sonnet-4-6');
  });
});

describe('maskTraceData', () => {
  it('replaces a base64 image payload with a size placeholder', () => {
    const photo = 'A'.repeat(4000);
    const data = JSON.stringify({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: photo },
    });
    const masked = maskTraceData({ data });
    expect(masked).not.toContain(photo);
    expect(masked).toContain('[image redacted: 4000 base64 chars]');
  });

  it('leaves prompts and model output untouched', () => {
    const data = JSON.stringify({
      role: 'assistant',
      content: 'Vintage Fender Stratocaster, sunburst finish, some fret wear. Price around $1,200.',
    });
    expect(maskTraceData({ data })).toBe(data);
  });
});

describe('tracingEnabled', () => {
  it('is false when the Langfuse keys are absent', () => {
    expect(tracingEnabled({})).toBe(false);
  });

  it('is false when only one of the two keys is present', () => {
    expect(tracingEnabled({ LANGFUSE_PUBLIC_KEY: 'pk-lf-1' })).toBe(false);
    expect(tracingEnabled({ LANGFUSE_SECRET_KEY: 'sk-lf-1' })).toBe(false);
    expect(tracingEnabled({ LANGFUSE_PUBLIC_KEY: 'pk-lf-1', LANGFUSE_SECRET_KEY: 'sk-lf-1' })).toBe(true);
  });
});
