import { identifyItem, identifyItemDetailed, identifyItemsMulti, generateListingFields } from './vision.js';
import { AppError } from '../middleware/error.js';

vi.mock('./ai-client.js', () => ({
  analyzeImage: vi.fn(),
  analyzeImages: vi.fn(),
  chatText: vi.fn(),
}));

import { analyzeImage, analyzeImages, chatText } from './ai-client.js';

const VALID_VISION_JSON = {
  name: 'Sony WH-1000XM4 Headphones',
  description: 'Over-ear wireless noise-cancelling headphones in excellent condition.',
  category: 'electronics',
  condition: 'like_new',
  conditionNotes: 'Minor scuff on left ear cup',
  estimatedValueLow: 150,
  estimatedValueHigh: 220,
  brand: 'Sony',
  model: 'WH-1000XM4',
  suggestedTags: ['headphones', 'wireless', 'sony', 'noise-cancelling'],
};

const VALID_DETAILED_JSON = {
  candidates: [
    {
      name: 'Sony WH-1000XM4 Headphones',
      description: 'Over-ear wireless headphones.',
      category: 'electronics',
      condition: 'good',
      conditionNotes: '',
      brand: 'Sony',
      model: 'WH-1000XM4',
      features: ['noise-cancelling', 'wireless'],
      estimatedValueLow: 150,
      estimatedValueHigh: 200,
      confidence: 0.92,
    },
  ],
  reasoning: ['Black over-ear design', 'Sony branding visible'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('identifyItem', () => {
  it('parses a valid JSON response into VisionResult', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_VISION_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');

    expect(result.name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.description).toBe('Over-ear wireless noise-cancelling headphones in excellent condition.');
    expect(result.category).toBe('electronics');
    expect(result.condition).toBe('like_new');
    expect(result.conditionNotes).toBe('Minor scuff on left ear cup');
    expect(result.estimatedValueLow).toBe(150);
    expect(result.estimatedValueHigh).toBe(220);
    expect(result.brand).toBe('Sony');
    expect(result.model).toBe('WH-1000XM4');
    expect(result.suggestedTags).toEqual(['headphones', 'wireless', 'sony', 'noise-cancelling']);
  });

  it('clamps an over-long description to what POST /items will accept (fuller descriptions, 2026-09-05)', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify({ ...VALID_VISION_JSON, description: 'D'.repeat(4500) }),
      provider: 'gemini', model: 'gemini-3.5-flash-lite', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');

    expect(result.description).toHaveLength(4000);
  });

  it('clamps an over-long conditionNotes to what POST /items will accept', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify({ ...VALID_VISION_JSON, conditionNotes: 'A'.repeat(2500) }),
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');

    expect(result.conditionNotes).toHaveLength(2000);
  });

  it('parses JSON wrapped in markdown fences', async () => {
    const fenced = '```json\n' + JSON.stringify(VALID_VISION_JSON) + '\n```';
    vi.mocked(analyzeImage).mockResolvedValue({
      text: fenced,
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');
    expect(result.name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.condition).toBe('like_new');
  });

  it('parses JSON wrapped in plain fences (no language tag)', async () => {
    const fenced = '```\n' + JSON.stringify(VALID_VISION_JSON) + '\n```';
    vi.mocked(analyzeImage).mockResolvedValue({
      text: fenced,
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/png');
    expect(result.name).toBe('Sony WH-1000XM4 Headphones');
  });

  it('throws AppError with code AI_RESPONSE_INVALID for missing required fields', async () => {
    const incomplete = { name: 'Something', description: 'Desc' };
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(incomplete),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await expect(identifyItem('base64data', 'image/jpeg'))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
  });

  it('throws AppError 502 for completely malformed JSON (safeParseJSON wraps SyntaxError)', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: 'not json at all',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await expect(identifyItem('base64data', 'image/jpeg'))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
  });

  it('passes a validate hook so schema-invalid 200s fail over down the provider chain', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_VISION_JSON),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await identifyItem('base64data', 'image/jpeg');

    const options = vi.mocked(analyzeImage).mock.calls[0][4] as { validate?: (text: string) => void };
    expect(typeof options?.validate).toBe('function');
    expect(() => options.validate!(JSON.stringify({ foo: 'bar' }))).toThrow();
    expect(() => options.validate!(JSON.stringify(VALID_VISION_JSON))).not.toThrow();
  });

  it('normalizes unrecognized condition to good', async () => {
    const withOddCondition = { ...VALID_VISION_JSON, condition: 'used' };
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(withOddCondition),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');
    expect(result.condition).toBe('good');
  });

  it('defaults suggestedTags to empty array when omitted', async () => {
    const withoutTags = { ...VALID_VISION_JSON };
    delete (withoutTags as Partial<typeof VALID_VISION_JSON>).suggestedTags;
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(withoutTags),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItem('base64data', 'image/jpeg');
    expect(result.suggestedTags).toEqual([]);
  });
});

describe('identifyItemDetailed', () => {
  it('returns DetailedVisionResult with candidates array', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.92);
    expect(result.reasoning).toEqual(['Black over-ear design', 'Sony branding visible']);
  });

  it('parses AI-estimated weight and dimensions on a candidate', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify({
        candidates: [{
          name: 'Vintage Camera', description: 'd', category: 'electronics', condition: 'good',
          brand: null, model: null, estimatedValueLow: 50, estimatedValueHigh: 90, confidence: 0.9,
          weight: { value: 24, unit: 'oz' },
          dimensions: { length: 12, width: 9, height: 4, unit: 'in' },
          packageType: 'MAILING_BOX',
        }],
        reasoning: [],
      }),
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates[0].weight).toEqual({ value: 24, unit: 'oz' });
    expect(result.candidates[0].dimensions).toEqual({ length: 12, width: 9, height: 4, unit: 'in' });
    expect(result.candidates[0].packageType).toBe('MAILING_BOX');
  });

  it('parses a real MPN (part number) on a candidate', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify({
        candidates: [{
          name: 'Sony WH-1000XM4', description: 'd', category: 'electronics', condition: 'good',
          brand: 'Sony', model: 'WH-1000XM4', mpn: 'WH1000XM4/B',
          estimatedValueLow: 150, estimatedValueHigh: 200, confidence: 0.9,
        }],
        reasoning: [],
      }),
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates[0].mpn).toBe('WH1000XM4/B');
  });

  it('preserves a provided candidate aspects bag', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify({
        candidates: [{
          name: 'Sony WH-1000XM4', description: 'd', category: 'electronics', condition: 'good',
          brand: 'Sony', model: 'WH-1000XM4', aspects: { Brand: ['Sony'] },
          estimatedValueLow: 150, estimatedValueHigh: 200, confidence: 0.9,
        }],
        reasoning: [],
      }),
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates[0].aspects).toEqual({ Brand: ['Sony'] });
  });

  it('passes a validate hook accepting either detailed or single schema', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await identifyItemDetailed('base64data', 'image/jpeg');

    const options = vi.mocked(analyzeImage).mock.calls[0][4] as { validate?: (text: string) => void };
    expect(typeof options?.validate).toBe('function');
    expect(() => options.validate!(JSON.stringify({ foo: 'bar' }))).toThrow();
    expect(() => options.validate!(JSON.stringify(VALID_DETAILED_JSON))).not.toThrow();
    expect(() => options.validate!(JSON.stringify(VALID_VISION_JSON))).not.toThrow();
  });

  it('falls back to single-candidate VisionResult when detailed parse fails', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_VISION_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.8);
    expect(result.reasoning).toEqual(['Identified by visual analysis']);
  });

  it('throws AppError when both detailed and simple parse fail', async () => {
    const invalid = { foo: 'bar' };
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(invalid),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await expect(identifyItemDetailed('base64data', 'image/jpeg'))
      .rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_RESPONSE_INVALID',
        message: expect.stringMatching(/detailed:.*single:/s),
      });
  });

  it('stamps identification provenance from the single-image vision call', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'local', model: 'qwen3-vl:8b-instruct', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');

    expect(result.provenance).toEqual({
      identification: { provider: 'local', model: 'qwen3-vl:8b-instruct', fallbacks: 0 },
    });
  });
});

describe('identifyItemsMulti', () => {
  const mockImages = [
    { base64: 'img1base64', mediaType: 'image/jpeg' },
    { base64: 'img2base64', mediaType: 'image/jpeg' },
  ];

  it('returns DetailedVisionResult from multi-image call', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.92);
    expect(result.reasoning).toEqual(['Black over-ear design', 'Sony branding visible']);
  });

  it('accepts null conditionNotes from the model (Gemini sends null, live 502 2026-07-10)', async () => {
    const withNullNotes = {
      ...VALID_DETAILED_JSON,
      candidates: [{ ...VALID_DETAILED_JSON.candidates[0], conditionNotes: null }],
    };
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(withNullNotes),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].conditionNotes).toBe('');
  });

  it('uses single-image prompt when given 1 image', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
      fallbacks: 0,
    });

    await identifyItemsMulti([mockImages[0]]);
    const call = vi.mocked(analyzeImages).mock.calls[0];
    expect(call[2]).toContain('Identify this item');
    expect(call[2]).not.toContain('photos of the SAME item');
  });

  it('uses multi-image prompt when given 2+ images', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    await identifyItemsMulti(mockImages);
    const call = vi.mocked(analyzeImages).mock.calls[0];
    expect(call[2]).toContain('2 photos of the SAME item');
  });

  it('falls back to single-candidate when detailed parse fails', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_VISION_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.8);
  });

  it('coerces a bare-number weight to {value, unit:"oz"} (gemini-3.5-flash drift, live 502 2026-08-05)', async () => {
    const withNumberWeight = {
      ...VALID_DETAILED_JSON,
      candidates: [{ ...VALID_DETAILED_JSON.candidates[0], weight: 14 }],
    };
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(withNumberWeight),
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].weight).toEqual({ value: 14, unit: 'oz' });
  });

  it('accepts weight: null from the model (Gemini null habit, cf. conditionNotes 2026-07-10)', async () => {
    const withNullWeight = {
      ...VALID_DETAILED_JSON,
      candidates: [{ ...VALID_DETAILED_JSON.candidates[0], weight: null }],
    };
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(withNullWeight),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].weight).toBeUndefined();
  });

  it('drops an implausible bare-number weight (>100 lb) instead of stamping it as ounces', async () => {
    const withAbsurdWeight = {
      ...VALID_DETAILED_JSON,
      candidates: [{ ...VALID_DETAILED_JSON.candidates[0], weight: 99999 }],
    };
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(withAbsurdWeight),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].weight).toBeUndefined();
  });

  it('throws AppError when both parse paths fail', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ foo: 'bar' }),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    await expect(identifyItemsMulti(mockImages))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
  });

  it('passes a validate hook so schema-invalid 200s fail over down the provider chain', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    await identifyItemsMulti(mockImages);

    const options = vi.mocked(analyzeImages).mock.calls[0][3] as { validate?: (text: string) => void };
    expect(typeof options?.validate).toBe('function');
    expect(() => options.validate!(JSON.stringify({ foo: 'bar' })))
      .toThrow(/detailed:.*single:/s);
    expect(() => options.validate!(JSON.stringify(VALID_DETAILED_JSON))).not.toThrow();
  });

  it('normalizes condition through Zod transform', async () => {
    const withRawCondition = {
      ...VALID_DETAILED_JSON,
      candidates: [{
        ...VALID_DETAILED_JSON.candidates[0],
        condition: 'excellent',
      }],
    };
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(withRawCondition),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
      fallbacks: 0,
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].condition).toBe('like_new');
  });

  it('asks for a structured buyer-facing description (specs + what the photos show), not a one-liner', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'gemini', model: 'gemini-3.5-flash-lite', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    await identifyItemsMulti(mockImages);

    const systemPrompt = vi.mocked(analyzeImages).mock.calls[0][1];
    // eBay-description spec (research 2026-09-06): length, section order, summary-first, policy don'ts.
    expect(systemPrompt).toMatch(/description: .*150.*300 words/s);
    expect(systemPrompt).toMatch(/Overview.*Condition.*Function.*Included.*Specs/s);
    expect(systemPrompt).toMatch(/first (two|2).*sentences.*stand alone/is);
    expect(systemPrompt).toMatch(/no invented specs/i);
    expect(systemPrompt).toMatch(/other marketplaces/i);
  });

  it('asks for condition notes in the seller\'s first-person voice with no hedging or "untested" disclaimers', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'gemini', model: 'gemini-3.5-flash-lite', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    await identifyItemsMulti(mockImages);

    const systemPrompt = vi.mocked(analyzeImages).mock.calls[0][1];
    expect(systemPrompt).toMatch(/conditionNotes: .*first person/s);
    expect(systemPrompt).toMatch(/never .*"appears to be"/is);
    expect(systemPrompt).toMatch(/never .*"untested"/is);
  });

  it('stamps identification provenance (provider, model, fallbacks) from the vision call', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 1,
    });

    const result = await identifyItemsMulti([{ base64: 'a', mediaType: 'image/jpeg' }]);

    expect(result.provenance).toEqual({
      identification: { provider: 'gemini', model: 'gemini-2.5-flash', fallbacks: 1 },
    });
  });
});

describe('generateListingFields', () => {
  const baseInput = {
    scanData: { brand: 'Sony', model: 'WH-1000XM4', category: 'electronics', condition: 'good', conditionNotes: '', features: [], description: 'd' },
    photoUrls: [],
    ebayCategorySuggestion: { categoryId: '9355', categoryName: 'Headphones' },
    requiredAspects: {},
    soldComps: [], activeComps: [], reverbComps: [],
    sellerDefaults: { weightUnit: 'oz', dimensionUnit: 'in', packageType: 'box', currency: 'USD' },
  };

  it('returns the vision call provenance alongside the listing fields', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: {} } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 1,
    });

    const fields = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(fields.provenance).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash', fallbacks: 1 });
  });

  it('asks for EVERY applicable value on MULTI-cardinality aspects (Features) instead of a single pick — live: 84/84 items carried one Features value', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Features: ['Active Noise Cancellation', 'Bluetooth'] } } }),
      provider: 'gemini', model: 'gemini-3.5-flash-lite', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const fields = await generateListingFields({
      ...baseInput,
      images: [{ base64: 'b64', mediaType: 'image/jpeg' }],
      requiredAspects: { Features: { required: false, values: ['Active Noise Cancellation', 'Bluetooth', 'Wired'], cardinality: 'MULTI' } } as never,
    });

    const systemPrompt = vi.mocked(analyzeImages).mock.calls[0][1];
    expect(systemPrompt).toMatch(/cardinality.*MULTI.*every.*value/is);
    expect(fields.ebay?.aspects.Features).toEqual(['Active Noise Cancellation', 'Bluetooth']);
  });

  it('drops aspect values outside eBay\'s allowed list and canonicalizes casing — a hallucinated value never reaches Revise', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Features: ['active noise cancellation', 'Levitation'], Color: ['Sky Blue'], MPN: ['MGYL3AM/A'] } } }),
      provider: 'gemini', model: 'gemini-3.5-flash-lite', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const fields = await generateListingFields({
      ...baseInput,
      images: [{ base64: 'b64', mediaType: 'image/jpeg' }],
      requiredAspects: {
        Features: { required: false, values: ['Active Noise Cancellation', 'Wireless'], cardinality: 'MULTI' },
        Color: { required: false, values: ['Silver', 'Space Gray'], cardinality: 'SINGLE' },
        MPN: { required: false, values: null, cardinality: 'SINGLE' },
      } as never,
    });

    expect(fields.ebay?.aspects).toEqual({ Features: ['Active Noise Cancellation'], MPN: ['MGYL3AM/A'] });
  });

  it('uses provided images via the vision path instead of fetching from photoUrls', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: ['Sony'] } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const images = [{ base64: 'b64', mediaType: 'image/jpeg' }];
    await generateListingFields({ ...baseInput, images });

    expect(analyzeImages).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeImages).mock.calls[0][0]).toEqual(images);
  });

  it('passes a schema validate hook on the photo-less chatText path (fail-over on drift)', async () => {
    vi.mocked(chatText).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: {} } }),
      provider: 'gemini', model: 'gemini-2.5-flash',
    } as never);

    await generateListingFields({ ...baseInput });

    expect(chatText).toHaveBeenCalledTimes(1);
    const options = vi.mocked(chatText).mock.calls[0][2] as { validate?: unknown };
    expect(typeof options?.validate).toBe('function');
  });

  it('injects the Reverb flat-category list into the prompt so the AI picks a real category verbatim', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: {} } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    await generateListingFields({
      ...baseInput,
      images: [{ base64: 'b64', mediaType: 'image/jpeg' }],
      reverbCategories: ['Effects and Pedals / Distortion', 'Pro Audio / Microphones'],
    });

    const userPrompt = vi.mocked(analyzeImages).mock.calls[0][2] as string;
    expect(userPrompt).toContain('REVERB CATEGORIES');
    expect(userPrompt).toContain('Effects and Pedals / Distortion');
    expect(userPrompt).toContain('Pro Audio / Microphones');
  });

  it('instructs the AI to pick the DEEPEST fitting category path (cascade resolution)', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: {} } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });
    await generateListingFields({
      ...baseInput,
      images: [{ base64: 'b64', mediaType: 'image/jpeg' }],
      reverbCategories: ['Effects and Pedals', 'Effects and Pedals / Distortion'],
    });
    const userPrompt = vi.mocked(analyzeImages).mock.calls[0][2] as string;
    expect(userPrompt).toMatch(/DEEPEST/);
  });

  it('coerces scalar-string aspect values to string arrays', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: 'Sony', Color: ['Black'] } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.aspects).toEqual({ Brand: ['Sony'], Color: ['Black'] });
  });

  it('degrades a malformed aspect value instead of throwing a 502 — good values survive', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: ['Sony'], Bad: null } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.aspects?.Brand).toEqual(['Sony']);
  });

  it('coerces a bare-number ebay.weight to {value, unit:"oz"} (same drift class as candidates weight)', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({
        title: 't', description: 'd',
        ebay: { title: 'et', aspects: {}, weight: 12 },
      }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.weight).toEqual({ value: 12, unit: 'oz' });
  });

  it('passes a validate hook so schema-invalid listing-fields responses fail over down the chain', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: {} } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    const options = vi.mocked(analyzeImages).mock.calls[0][3] as { validate?: (text: string) => void };
    expect(typeof options?.validate).toBe('function');
    expect(() => options.validate!(JSON.stringify({ ebay: {} }))).toThrow();
    expect(() => options.validate!(JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et' } }))).not.toThrow();
  });

  it('maps an implausible bare-number ebay.weight to the zero sentinel instead of stamping it', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({
        title: 't', description: 'd',
        ebay: { title: 'et', aspects: {}, weight: 99999 },
      }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.weight).toEqual({ value: 0, unit: 'oz' });
  });

  it('maps ebay.weight: null to the zero sentinel (Gemini null habit)', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({
        title: 't', description: 'd',
        ebay: { title: 'et', aspects: {}, weight: null },
      }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.weight).toEqual({ value: 0, unit: 'oz' });
  });

  it('coerces a numeric reverb.year to string (gemini-2.5-flash, live aspect-prefill warn 2026-08-05)', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({
        title: 't', description: 'd',
        ebay: { title: 'et', aspects: {} },
        reverb: { make: 'Roland', model: 'TR-808', title: 'rt', year: 1984 },
      }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.reverb?.year).toBe('1984');
  });

  it('runs the constrained pick pass for a required enum aspect the first call left unfilled', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: ['Sony'] } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, fallbacks: 0,
    });
    vi.mocked(chatText).mockResolvedValue({
      text: '{"Type":"Canal Earbud (In Ear Canal)"}',
      provider: 'gemini', model: 'gemini-2.5-flash',
    });

    const result = await generateListingFields({
      ...baseInput,
      images: [{ base64: 'b64', mediaType: 'image/jpeg' }],
      requiredAspects: {
        Type: { required: true, values: ['Canal Earbud (In Ear Canal)', 'Ear-Cup (Over the Ear)', 'Ear-Pad (On the Ear)'] },
        Brand: { required: true, values: null },
      },
    });

    expect(result.ebay?.aspects).toEqual({ Brand: ['Sony'], Type: ['Canal Earbud (In Ear Canal)'] });
  });
});
