import { MaskingSpanProcessor } from './masking-span-processor.js';

describe('MaskingSpanProcessor', () => {
  it('masks span attributes before handing the span to the inner processor', () => {
    const photo = 'C'.repeat(2000);
    const span = { attributes: { 'llm.input.image': `data:image/jpeg;base64,${photo}` } };
    let seen = '';
    const inner = {
      onStart: () => {},
      onEnd: (s: { attributes: Record<string, unknown> }) => { seen = String(s.attributes['llm.input.image']); },
      forceFlush: async () => {},
      shutdown: async () => {},
    };

    new MaskingSpanProcessor(inner as never).onEnd(span as never);

    expect(seen).not.toContain(photo);
    expect(seen).toContain('image redacted');
  });
});
