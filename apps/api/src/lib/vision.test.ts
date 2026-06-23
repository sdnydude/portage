import { identifyItem, identifyItemDetailed, identifyItemsMulti, generateListingFields } from './vision.js';
import { AppError } from '../middleware/error.js';

vi.mock('./ai-client.js', () => ({
  analyzeImage: vi.fn(),
  analyzeImages: vi.fn(),
  chatText: vi.fn(),
}));

import { analyzeImage, analyzeImages } from './ai-client.js';

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

  it('parses JSON wrapped in markdown fences', async () => {
    const fenced = '```json\n' + JSON.stringify(VALID_VISION_JSON) + '\n```';
    vi.mocked(analyzeImage).mockResolvedValue({
      text: fenced,
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
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
    });

    await expect(identifyItem('base64data', 'image/jpeg'))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
  });

  it('throws SyntaxError for completely malformed JSON', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: 'not json at all',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
    });

    await expect(identifyItem('base64data', 'image/jpeg')).rejects.toThrow();
  });

  it('normalizes unrecognized condition to good', async () => {
    const withOddCondition = { ...VALID_VISION_JSON, condition: 'used' };
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(withOddCondition),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
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
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50,
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
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50,
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
      provider: 'anthropic', model: 'claude-sonnet-4', inputTokens: 100, outputTokens: 50,
    });

    const result = await identifyItemDetailed('base64data', 'image/jpeg');
    expect(result.candidates[0].aspects).toEqual({ Brand: ['Sony'] });
  });

  it('falls back to single-candidate VisionResult when detailed parse fails', async () => {
    vi.mocked(analyzeImage).mockResolvedValue({
      text: JSON.stringify(VALID_VISION_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
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
    });

    await expect(identifyItemDetailed('base64data', 'image/jpeg'))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
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
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.92);
    expect(result.reasoning).toEqual(['Black over-ear design', 'Sony branding visible']);
  });

  it('uses single-image prompt when given 1 image', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify(VALID_DETAILED_JSON),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
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
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Sony WH-1000XM4 Headphones');
    expect(result.candidates[0].confidence).toBe(0.8);
  });

  it('throws AppError when both parse paths fail', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ foo: 'bar' }),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 200,
      outputTokens: 100,
    });

    await expect(identifyItemsMulti(mockImages))
      .rejects.toMatchObject({ statusCode: 502, code: 'AI_RESPONSE_INVALID' });
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
    });

    const result = await identifyItemsMulti(mockImages);
    expect(result.candidates[0].condition).toBe('like_new');
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

  it('uses provided images via the vision path instead of fetching from photoUrls', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: ['Sony'] } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50,
    });

    const images = [{ base64: 'b64', mediaType: 'image/jpeg' }];
    await generateListingFields({ ...baseInput, images });

    expect(analyzeImages).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeImages).mock.calls[0][0]).toEqual(images);
  });

  it('coerces scalar-string aspect values to string arrays', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: 'Sony', Color: ['Black'] } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.aspects).toEqual({ Brand: ['Sony'], Color: ['Black'] });
  });

  it('degrades a malformed aspect value instead of throwing a 502 — good values survive', async () => {
    vi.mocked(analyzeImages).mockResolvedValue({
      text: JSON.stringify({ title: 't', description: 'd', ebay: { title: 'et', aspects: { Brand: ['Sony'], Bad: null } } }),
      provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50,
    });

    const result = await generateListingFields({ ...baseInput, images: [{ base64: 'b64', mediaType: 'image/jpeg' }] });

    expect(result.ebay?.aspects?.Brand).toEqual(['Sony']);
  });
});
