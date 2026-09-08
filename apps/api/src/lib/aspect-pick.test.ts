import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findMissingEnumAspects, pickMissingRequiredAspects } from './aspect-pick.js';

vi.mock('./ai-client.js', () => ({
  chatText: vi.fn(),
}));

import { chatText } from './ai-client.js';

describe('findMissingEnumAspects', () => {
  it('returns required enum aspects the AI left unfilled', () => {
    const requiredAspects = {
      Type: { required: true, values: ['Overdrive', 'Delay', 'Reverb', 'Fuzz'] },
      Brand: { required: true, values: null }, // free-text — never a pick candidate
    };
    const aspects = { Brand: ['Boss'] }; // Type missing entirely

    expect(findMissingEnumAspects(aspects, requiredAspects)).toEqual([
      { name: 'Type', values: ['Overdrive', 'Delay', 'Reverb', 'Fuzz'], cardinality: 'SINGLE' },
    ]);
  });

  it('treats a value outside the allowed enum as missing, but accepts case-insensitive matches', () => {
    const requiredAspects = {
      Type: { required: true, values: ['Overdrive', 'Delay'] },
      Color: { required: true, values: ['Black', 'Silver'] },
    };
    // Type is a hallucination (not in enum) → gap; Color matches modulo case → filled.
    const aspects = { Type: ['Distortion Pedal'], Color: ['black'] };

    expect(findMissingEnumAspects(aspects, requiredAspects)).toEqual([
      { name: 'Type', values: ['Overdrive', 'Delay'], cardinality: 'SINGLE' },
    ]);
  });
});

describe('pickMissingRequiredAspects', () => {
  beforeEach(() => {
    vi.mocked(chatText).mockReset();
  });

  it('fills a missing enum aspect from the constrained pick, normalized to canonical enum casing', async () => {
    vi.mocked(chatText).mockResolvedValue({
      text: '{"Type":"overdrive"}',
      provider: 'test',
      model: 'test',
    });

    const result = await pickMissingRequiredAspects({
      aspects: { Brand: ['Boss'] },
      requiredAspects: {
        Type: { required: true, values: ['Overdrive', 'Delay'] },
        Brand: { required: true, values: null },
      },
      itemContext: { brand: 'Boss', model: 'SD-1', category: 'guitar pedal', title: 'Boss SD-1 Super OverDrive' },
    });

    expect(result).toEqual({ Brand: ['Boss'], Type: ['Overdrive'] });
    expect(vi.mocked(chatText)).toHaveBeenCalledTimes(1);
  });

  it('fills a missing MULTI-cardinality aspect with every allowed value the pick returns (SINGLE stays one)', async () => {
    vi.mocked(chatText).mockResolvedValue({
      text: '{"Features":["wireless","Bluetooth","Levitation"],"Type":["Overdrive","Delay"]}',
      provider: 'test',
      model: 'test',
    });

    const result = await pickMissingRequiredAspects({
      aspects: {},
      requiredAspects: {
        Features: { required: true, values: ['Wireless', 'Bluetooth', 'Foldable'], cardinality: 'MULTI' },
        Type: { required: true, values: ['Overdrive', 'Delay'], cardinality: 'SINGLE' },
      } as never,
      itemContext: { brand: 'Sony', model: 'WH-1000XM4', category: 'headphones', title: 'Sony WH-1000XM4' },
    });

    expect(result).toEqual({ Features: ['Wireless', 'Bluetooth'], Type: ['Overdrive'] });
  });

  it('drops a pick that is not in the allowed enum instead of merging a hallucination', async () => {
    vi.mocked(chatText).mockResolvedValue({
      text: '{"Type":"Distortion"}', // not in the enum
      provider: 'test',
      model: 'test',
    });

    const result = await pickMissingRequiredAspects({
      aspects: {},
      requiredAspects: { Type: { required: true, values: ['Overdrive', 'Delay'] } },
      itemContext: { brand: 'Boss', model: 'SD-1', category: 'guitar pedal', title: 'Boss SD-1' },
    });

    expect(result).toEqual({});
  });

  it('skips huge enums (e.g. Brand, 844 values) and still picks the small ones', async () => {
    vi.mocked(chatText).mockResolvedValue({
      text: '{"Type":"Overdrive"}',
      provider: 'test',
      model: 'test',
    });

    const hugeEnum = Array.from({ length: 500 }, (_, i) => `Brand${i}`);
    const result = await pickMissingRequiredAspects({
      aspects: {},
      requiredAspects: {
        Brand: { required: true, values: hugeEnum },
        Type: { required: true, values: ['Overdrive', 'Delay'] },
      },
      itemContext: { brand: 'Boss', model: 'SD-1', category: 'guitar pedal', title: 'Boss SD-1' },
    });

    expect(result).toEqual({ Type: ['Overdrive'] });
    const [, userPrompt] = vi.mocked(chatText).mock.calls[0];
    expect(userPrompt).not.toContain('Brand0'); // huge enum never sent to the model
    expect(userPrompt).toContain('"Type"');
  });

  it('returns aspects unchanged when the pick call fails — never throws into the listing flow', async () => {
    vi.mocked(chatText).mockRejectedValue(new Error('provider down'));

    const result = await pickMissingRequiredAspects({
      aspects: { Brand: ['Boss'] },
      requiredAspects: { Type: { required: true, values: ['Overdrive', 'Delay'] } },
      itemContext: { brand: 'Boss', model: 'SD-1', category: 'guitar pedal', title: 'Boss SD-1' },
    });

    expect(result).toEqual({ Brand: ['Boss'] });
  });
});
