import type { RecognitionCandidate } from '@portage/shared';
import { prefillCandidateAspects } from './aspect-prefill.js';

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: {
    getCategorySuggestion: vi.fn(),
    getRequiredAspects: vi.fn(),
  },
}));

vi.mock('./vision.js', () => ({
  generateListingFields: vi.fn(),
}));

import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { generateListingFields } from './vision.js';

function cand(overrides: Partial<RecognitionCandidate> = {}): RecognitionCandidate {
  return {
    name: 'Sony WH-1000XM4',
    description: 'Over-ear wireless headphones',
    category: 'electronics',
    condition: 'good',
    conditionNotes: '',
    brand: 'Sony',
    model: 'WH-1000XM4',
    features: [],
    estimatedValueLow: 150,
    estimatedValueHigh: 200,
    confidence: 0.9,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prefillCandidateAspects', () => {
  it('fills the top candidate aspects from generateListingFields output', async () => {
    vi.mocked(EbayAdapter.getCategorySuggestion).mockResolvedValue({ categoryId: '9355', categoryName: 'Headphones' });
    vi.mocked(EbayAdapter.getRequiredAspects).mockResolvedValue({
      Brand: { required: true, values: null, cardinality: 'SINGLE' },
    });
    vi.mocked(generateListingFields).mockResolvedValue({
      ebay: { aspects: { Brand: ['Sony'], Model: ['WH-1000XM4'] } },
    } as unknown as Awaited<ReturnType<typeof generateListingFields>>);

    const result = await prefillCandidateAspects([cand()]);

    expect(result[0].aspects).toEqual({ Brand: ['Sony'], Model: ['WH-1000XM4'] });
  });

  it('forwards imageBase64 as a pre-fetched image to generateListingFields', async () => {
    vi.mocked(EbayAdapter.getCategorySuggestion).mockResolvedValue({ categoryId: '9355', categoryName: 'Headphones' });
    vi.mocked(EbayAdapter.getRequiredAspects).mockResolvedValue({});
    vi.mocked(generateListingFields).mockResolvedValue({
      ebay: { aspects: {} },
    } as unknown as Awaited<ReturnType<typeof generateListingFields>>);

    await prefillCandidateAspects([cand()], 'scan-base64-bytes');

    expect(generateListingFields).toHaveBeenCalledWith(
      expect.objectContaining({ images: [{ base64: 'scan-base64-bytes', mediaType: 'image/jpeg' }] }),
    );
  });

  it('returns candidates unchanged when no eBay category is found', async () => {
    vi.mocked(EbayAdapter.getCategorySuggestion).mockResolvedValue(null);

    const input = [cand()];
    const result = await prefillCandidateAspects(input);

    expect(result[0].aspects).toBeUndefined();
    expect(generateListingFields).not.toHaveBeenCalled();
  });

  it('is non-fatal — returns candidates unchanged when generateListingFields throws', async () => {
    vi.mocked(EbayAdapter.getCategorySuggestion).mockResolvedValue({ categoryId: '9355', categoryName: 'Headphones' });
    vi.mocked(EbayAdapter.getRequiredAspects).mockResolvedValue({
      Brand: { required: true, values: null, cardinality: 'SINGLE' },
    });
    vi.mocked(generateListingFields).mockRejectedValue(new Error('AI timeout'));

    const result = await prefillCandidateAspects([cand()]);

    expect(result[0].aspects).toBeUndefined();
  });

  it('fills only the top candidate, leaving other candidates untouched', async () => {
    vi.mocked(EbayAdapter.getCategorySuggestion).mockResolvedValue({ categoryId: '9355', categoryName: 'Headphones' });
    vi.mocked(EbayAdapter.getRequiredAspects).mockResolvedValue({});
    vi.mocked(generateListingFields).mockResolvedValue({
      ebay: { aspects: { Brand: ['Sony'] } },
    } as unknown as Awaited<ReturnType<typeof generateListingFields>>);

    const result = await prefillCandidateAspects([cand(), cand({ name: 'Bose QC45', brand: 'Bose' })]);

    expect(result[0].aspects).toEqual({ Brand: ['Sony'] });
    expect(result[1].aspects).toBeUndefined();
  });
});
