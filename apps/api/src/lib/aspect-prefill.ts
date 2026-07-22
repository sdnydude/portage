import type { RecognitionCandidate } from '@portage/shared';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { generateListingFields } from './vision.js';
import { createLogger } from './logger.js';
import { traceStep } from './tracing.js';

const logger = createLogger('aspect-prefill');

/**
 * Best-effort, never-throws prefill of eBay item specifics (aspects) onto the
 * top (auto-selected) scan candidate. Mirrors the prepare-listing orchestration
 * (getCategorySuggestion → getRequiredAspects → generateListingFields) so the
 * scan response already carries required specifics, and only ever enriches the
 * candidate the user is shown first — other candidates may be different products
 * and must not inherit the top candidate's category aspects. Any failure is
 * non-fatal: the candidates are returned unchanged and review-time aspect
 * resolution is unaffected.
 */
export async function prefillCandidateAspects(
  candidates: RecognitionCandidate[],
  imageBase64?: string,
): Promise<RecognitionCandidate[]> {
  const top = candidates[0];
  if (!top) return candidates;

  return traceStep('prefill-aspects', () => runPrefill(candidates, top, imageBase64));
}

async function runPrefill(
  candidates: RecognitionCandidate[],
  top: RecognitionCandidate,
  imageBase64?: string,
): Promise<RecognitionCandidate[]> {
  try {
    const searchQuery = [top.brand, top.model].filter(Boolean).join(' ') || top.name;

    const categorySuggestion = await EbayAdapter.getCategorySuggestion(searchQuery);
    if (!categorySuggestion) return candidates;

    const requiredAspects = await EbayAdapter.getRequiredAspects(categorySuggestion.categoryId);

    const fields = await generateListingFields({
      scanData: {
        brand: top.brand ?? '',
        model: top.model ?? '',
        category: top.category,
        condition: top.condition,
        conditionNotes: top.conditionNotes,
        features: top.features,
        description: top.description,
      },
      photoUrls: [],
      // Reuse the already-processed scan image so generateListingFields takes the
      // vision path (JSON-mode + visual context) instead of the unreliable
      // text-only fallback.
      images: imageBase64 ? [{ base64: imageBase64, mediaType: 'image/jpeg' }] : undefined,
      ebayCategorySuggestion: categorySuggestion,
      requiredAspects,
      soldComps: [],
      activeComps: [],
      reverbComps: [],
      sellerDefaults: { weightUnit: 'oz', dimensionUnit: 'in', packageType: 'box', currency: 'USD' },
    });

    const filled = fields.ebay?.aspects;
    if (filled && Object.keys(filled).length > 0) {
      return candidates.map((c, i) =>
        i === 0 ? { ...c, aspects: { ...(c.aspects ?? {}), ...filled } } : c,
      );
    }

    return candidates;
  } catch (err) {
    logger.warn(
      { error: (err as Error).message },
      'Aspect prefill failed — returning candidates without prefilled aspects',
    );
    return candidates;
  }
}
