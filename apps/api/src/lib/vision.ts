import { z } from 'zod';
import { analyzeImage, analyzeImages, chatText } from './ai-client.js';
import { createLogger } from './logger.js';
import type { ImageInput } from './ai-client.js';
import { AppError } from '../middleware/error.js';
import { pickMissingRequiredAspects } from './aspect-pick.js';
import type { RecognitionCandidate } from '@portage/shared';

const logger = createLogger('vision');

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(extractJSON(text));
  } catch {
    throw new AppError(502, 'AI_RESPONSE_INVALID', 'AI returned unparseable response');
  }
}

const CONDITION_NORMALIZE: Record<string, string> = {
  new: 'new', mint: 'new', sealed: 'new',
  excellent: 'like_new', like_new: 'like_new',
  refurbished: 'like_new', open_box: 'like_new',
  very_good: 'good', good: 'good',
  used: 'good', pre_owned: 'good',
  fair: 'fair', worn: 'fair',
  poor: 'poor', damaged: 'poor',
  broken: 'poor', parts_only: 'poor', for_parts: 'poor',
};

function normalizeCondition(raw: string): 'new' | 'like_new' | 'good' | 'fair' | 'poor' {
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const normalized = CONDITION_NORMALIZE[key];
  if (!normalized) {
    logger.warn({ rawCondition: raw, key }, 'Unrecognized condition from AI — defaulting to good');
  }
  return (normalized ?? 'good') as 'new' | 'like_new' | 'good' | 'fair' | 'poor';
}

/** Mirrors the `conditionNotes` cap in createItemSchema (routes/items.ts). */
const MAX_CONDITION_NOTES = 2000;

const VisionResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  condition: z.string().transform(normalizeCondition),
  // Clamped to the POST /items cap: the model treats "brief" as a suggestion,
  // and an over-long note made the scan pipeline emit a value its own API
  // rejects — surfacing as an opaque "Validation failed" on save.
  conditionNotes: z.string().nullish().transform((v) => (v ?? '').slice(0, MAX_CONDITION_NOTES)),
  estimatedValueLow: z.number(),
  estimatedValueHigh: z.number(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  suggestedTags: z.array(z.string()).optional().default([]),
});

const CandidateSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  condition: z.string().transform(normalizeCondition),
  // Clamped to the POST /items cap: the model treats "brief" as a suggestion,
  // and an over-long note made the scan pipeline emit a value its own API
  // rejects — surfacing as an opaque "Validation failed" on save.
  conditionNotes: z.string().nullish().transform((v) => (v ?? '').slice(0, MAX_CONDITION_NOTES)),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  mpn: z.string().nullable().optional(),
  aspects: z.record(z.string(), z.array(z.string())).optional().default({}),
  features: z.array(z.string()).optional().default([]),
  estimatedValueLow: z.number(),
  estimatedValueHigh: z.number(),
  confidence: z.number().min(0).max(1),
  // AI-estimated packaged shipping weight (ounces) + box dimensions (inches), so a
  // scanned item carries weight/dims for eBay Calculated shipping without waiting
  // for the prepare-listing step. Optional — older responses may omit them.
  // Some models flatten weight to a bare oz number despite the prompted object
  // shape (gemini-3.5-flash drift, live 502 2026-08-05) — coerce instead of 502ing.
  // A bare number is only trusted as ounces inside a plausible packaged-shipping
  // range (≤100 lb); outside it the unit claim is untrustworthy, so drop the
  // weight rather than stamp a wrong value into eBay calculated shipping.
  weight: z.union([
    z.object({ value: z.number(), unit: z.string() }),
    z.number().transform((v) => (v > 0 && v <= 1600 ? { value: v, unit: 'oz' } : undefined)),
    z.null().transform(() => undefined),
  ]).optional(),
  dimensions: z.object({ length: z.number(), width: z.number(), height: z.number(), unit: z.string() }).optional(),
  packageType: z.string().optional(),
});

const DetailedVisionResultSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
  reasoning: z.array(z.string()).optional().default([]),
});

const ListingFieldsOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  condition: z.string().optional().default('good'),
  conditionDescription: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  isMusicGear: z.boolean().optional().default(false),
  aiConfidence: z.number().optional().default(0.5),
  ebay: z.object({
    title: z.string(),
    categoryId: z.string().optional().default(''),
    categoryName: z.string().optional().default(''),
    condition: z.string().optional().default(''),
    conditionDescription: z.string().optional().default(''),
    // Coerce scalar-string aspect values (some models return "Sony" instead of
    // ["Sony"]) to arrays. A malformed value (null/object) is caught PER KEY and
    // degrades to [] (dropped downstream by normalizeAspects) rather than failing
    // the whole parse — so one bad specific never 502s generateListingFields /
    // prepare-listing (which has no non-fatal guard). Good values still survive.
    aspects: z.record(
      z.string(),
      z.union([z.string().transform((v) => [v]), z.array(z.string())]).catch([]),
    ).optional().default({}),
    upc: z.string().nullable().optional().default(null),
    epid: z.string().nullable().optional().default(null),
    // Bare-number weight coerced, same drift class + same 100 lb plausibility rule
    // as candidates weight (2026-08-05); out-of-range maps to the existing
    // zero sentinel (field is non-optional here, so undefined would break the type).
    weight: z.union([
      z.object({ value: z.number(), unit: z.string() }),
      z.number().transform((v) => (v > 0 && v <= 1600 ? { value: v, unit: 'oz' } : { value: 0, unit: 'oz' })),
      z.null().transform(() => ({ value: 0, unit: 'oz' })),
    ]).optional().default({ value: 0, unit: 'oz' }),
    dimensions: z.object({ length: z.number(), width: z.number(), height: z.number(), unit: z.string() }).optional().default({ length: 0, width: 0, height: 0, unit: 'in' }),
    packageType: z.string().optional().default('LETTER'),
  }).passthrough().nullable().optional().default(null),
  reverb: z.object({
    make: z.string().optional().default(''),
    model: z.string().optional().default(''),
    title: z.string().optional().default(''),
    categoryUuid: z.string().optional().default(''),
    categoryName: z.string().optional().default(''),
    conditionUuid: z.string().optional().default(''),
    conditionName: z.string().optional().default(''),
    // Models return year as a bare number (gemini-2.5-flash, live warn 2026-08-05).
    year: z.union([z.string(), z.number().transform(String)]).nullable().optional().default(null),
    finish: z.string().nullable().optional().default(null),
    description: z.string().optional().default(''),
  }).passthrough().nullable().optional().default(null),
}).passthrough();

export interface VisionResult {
  name: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  conditionNotes: string;
  estimatedValueLow: number;
  estimatedValueHigh: number;
  brand: string | null;
  model: string | null;
  suggestedTags: string[];
}

const SYSTEM_PROMPT = `You are Porter, an AI assistant for Portage — an inventory and marketplace seller app.
Your job is to identify items from photos and provide structured data for listing them.

Analyze the image and return a JSON object with these fields:
- name: concise item name (e.g. "Sony WH-1000XM4 Wireless Headphones")
- description: 2-3 sentence description suitable for a marketplace listing
- category: one of: electronics, clothing, furniture, collectibles, sports, home, books, toys, tools, automotive, jewelry, art, music, other
- condition: one of: new, like_new, good, fair, poor
- conditionNotes: brief note on visible condition (e.g. "Minor scuff on left ear cup")
- estimatedValueLow: low end of resale value in USD (integer)
- estimatedValueHigh: high end of resale value in USD (integer)
- brand: brand name if identifiable, null otherwise
- model: model name/number if identifiable, null otherwise
- suggestedTags: array of 3-5 search tags

Respond with ONLY valid JSON. No markdown, no explanation.`;

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = raw.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw;
}

/** Chain-failover validator: throws AppError 502 (with per-schema Zod detail so
 *  drift incidents stay triageable from prod logs) unless the raw text parses
 *  under at least one of the given schemas. Runs inside the provider loop, so a
 *  throw fails over to the next provider instead of 502ing the request
 *  (gemini-3.5-flash weight drift outage, 2026-08-05). */
function schemaValidator(schemas: Array<{ name: string; schema: z.ZodTypeAny }>): (raw: string) => void {
  return (raw) => {
    const parsed = safeParseJSON(raw);
    const failures: string[] = [];
    for (const { name, schema } of schemas) {
      const result = schema.safeParse(parsed);
      if (result.success) return;
      failures.push(`${name}: ${result.error.message}`);
    }
    throw new AppError(502, 'AI_RESPONSE_INVALID', `AI vision response failed schema validation — ${failures.join('; ')}`);
  };
}

export async function identifyItem(imageBase64: string, mediaType: string): Promise<VisionResult> {
  const { text } = await analyzeImage(
    imageBase64,
    mediaType,
    SYSTEM_PROMPT,
    'Identify this item for marketplace listing. Respond with ONLY a JSON object, no other text.',
    {
      temperature: 0,
      maxTokens: 2048,
      validate: schemaValidator([{ name: 'single', schema: VisionResultSchema }]),
    },
  );

  const parsed = safeParseJSON(text);
  const result = VisionResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(502, 'AI_RESPONSE_INVALID', `AI scan returned invalid response: ${result.error.message}`);
  }
  return result.data;
}

const DETAILED_SYSTEM_PROMPT = `You are Porter, an AI assistant for Portage — an inventory and marketplace seller app.
Your job is to identify items from photos and provide multiple possible matches with reasoning.

Analyze the image and return a JSON object with:
- candidates: array of 1-3 possible matches, each with:
  - name, description, category, condition, conditionNotes
  - brand (string|null), model (string|null), features (string[])
  - mpn (string|null): the Manufacturer Part Number — the real part/SKU number printed on
    the item's label, box, plate, or sticker (e.g. "WH1000XM4/B", "DSR-PD170"). This is NOT
    the model name. If no genuine part number is visible, return null. Never put the model
    name here.
  - estimatedValueLow (int), estimatedValueHigh (int)
  - confidence (float 0-1, your confidence this is the correct identification)
  - weight: { value, unit:"oz" } — the realistic PACKAGED shipping weight (item + box
    + padding) in ounces, estimated from the item type. NEVER 0. (e.g. paperback ≈ 8oz,
    guitar pedal ≈ 14oz, projector ≈ 48oz, coffee mug ≈ 16oz)
  - dimensions: { length, width, height, unit:"in" } — the shipping box size in inches,
    estimated from the item. NEVER 0.
  - packageType: one of "LETTER" | "PACKAGE_THICK_ENVELOPE" | "MAILING_BOX" | "LARGE_PACKAGE", by size
- reasoning: array of 3-5 strings explaining what visual features led to the identification
  (e.g. "Pointed pocket flaps indicate Type III", "Tab logo suggests pre-1971")

Order candidates by confidence (highest first). Respond with ONLY valid JSON.`;

export interface DetailedVisionResult {
  candidates: RecognitionCandidate[];
  reasoning: string[];
}

export async function identifyItemDetailed(imageBase64: string, mediaType: string): Promise<DetailedVisionResult> {
  const { text } = await analyzeImage(
    imageBase64,
    mediaType,
    DETAILED_SYSTEM_PROMPT,
    'Identify this item with multiple candidates and reasoning.',
    {
      temperature: 0,
      maxTokens: 2048,
      validate: schemaValidator([
        { name: 'detailed', schema: DetailedVisionResultSchema },
        { name: 'single', schema: VisionResultSchema },
      ]),
    },
  );

  const parsed = safeParseJSON(text);

  const detailed = DetailedVisionResultSchema.safeParse(parsed);
  if (detailed.success) return detailed.data;

  const single = VisionResultSchema.safeParse(parsed);
  if (single.success) {
    return {
      candidates: [{
        ...single.data,
        features: single.data.suggestedTags,
        confidence: 0.8,
      }],
      reasoning: Array.isArray((parsed as Record<string, unknown>).reasoning)
        ? (parsed as Record<string, unknown>).reasoning as string[]
        : ['Identified by visual analysis'],
    };
  }

  // Mirrors identifyItemsMulti: both schemas' diagnostics survive for triage.
  throw new AppError(502, 'AI_RESPONSE_INVALID', `AI detailed scan returned invalid response — detailed: ${detailed.error.message}; single: ${single.error.message}`);
}

const LISTING_FIELDS_SYSTEM_PROMPT = `You are a marketplace listing expert. Generate production-quality fields for selling a used item on eBay and optionally Reverb.

RULES:
- eBay title must be ≤80 characters. Pack keywords: Brand + Model + Key Attributes + Condition hint
- Fill EVERY required item specific. When a specific provides a list of allowed values, you MUST output the single closest-matching value FROM THAT LIST — map the item to the best fit (e.g. an external SSD → "Portable External SSD", a hand tool → its closest "Type"). Never leave a required specific blank, never output "N/A" when the list has any reasonable match, and never invent a value that is not in the provided list. Only use "N/A" for a free-text specific (no allowed list) you genuinely cannot determine.
- Condition description must reference specific wear visible in photos (scratches, scuffs, patina, etc.)
- If no wear is visible, say "Item appears to be in [condition] condition with no visible wear."
- Price suggestion should target slightly below sold median for faster sale
- ALWAYS estimate a realistic PACKAGED shipping weight (item + box + padding) in ounces and the shipping box dimensions in inches, inferred from the item type, brand/model, and what is visible. These are required for shipping — NEVER return 0 for weight or any dimension. If unsure, estimate from a comparable item. Anchor examples: guitar pedal ≈ 12–18 oz in a 7×5×4 in box; vinyl LP ≈ 9 oz in 13×13×1; paperback book ≈ 8 oz in 9×6×1; wireless mic/instrument system ≈ 24–40 oz in a 12×9×4 box; coffee mug ≈ 16 oz in 6×6×5. Pick the closest analog and adjust. Flag them as estimates.
- Determine if item is music gear (instruments, amps, pedals, audio equipment, accessories)
- If music gear, fill Reverb fields. If not, set reverb to null and isMusicGear to false.

OUTPUT JSON STRUCTURE (all top-level fields required):
{
  "title": "General item title",
  "description": "General marketplace description",
  "condition": "new|like_new|good|fair|poor",
  "conditionDescription": "Visible wear details from photos",
  "brand": "Brand name",
  "model": "Model name/number",
  "isMusicGear": true/false,
  "aiConfidence": 0.0-1.0,
  "ebay": { "title": "≤80 char eBay title", "categoryId": "", "categoryName": "", "condition": "", "conditionDescription": "", "aspects": {}, "upc": null, "epid": null, "weight": {"value": <estimated packaged oz, never 0>, "unit":"oz"}, "dimensions": {"length": <in>, "width": <in>, "height": <in>, "unit":"in"}, "packageType": "LETTER|PACKAGE_THICK_ENVELOPE|MAILING_BOX|LARGE_PACKAGE — pick by size" },
  "reverb": null or { "make": "", "model": "", "title": "", "categoryUuid": "", "categoryName": "", "conditionUuid": "", "conditionName": "", "year": null, "finish": null, "description": "" }
}

No markdown, no explanation — ONLY valid JSON.`;

export interface ListingFieldsInput {
  scanData: {
    brand: string;
    model: string;
    category: string;
    condition: string;
    conditionNotes: string;
    features: string[];
    description: string;
  };
  photoUrls: string[];
  // Pre-fetched images (e.g. the in-memory scan buffer). When present, these are
  // used directly and photoUrls is not fetched — keeps the vision path (JSON-mode)
  // instead of the text-only fallback.
  images?: ImageInput[];
  ebayCategorySuggestion: { categoryId: string; categoryName: string } | null;
  // Reverb's real flat-category full_names (from /categories/flat). When
  // present the model must pick reverb.categoryName VERBATIM from this list —
  // free-text category names (and invented uuids) don't resolve on Reverb.
  reverbCategories?: string[];
  requiredAspects: Record<string, { required: boolean; values: string[] | null }>;
  soldComps: Array<{ title: string; price: number; condition: string; soldDate: string | null }>;
  activeComps: Array<{ title: string; price: number; condition: string }>;
  reverbComps: Array<{ title: string; price: number; condition: string }>;
  sellerDefaults: {
    weightUnit: string;
    dimensionUnit: string;
    packageType: string;
    currency: string;
  };
}

export interface ListingFieldsOutput {
  title: string;
  description: string;
  condition: string;
  conditionDescription: string;
  brand: string;
  model: string;
  isMusicGear: boolean;
  aiConfidence: number;
  ebay: {
    title: string;
    categoryId: string;
    categoryName: string;
    condition: string;
    conditionDescription: string;
    aspects: Record<string, string[]>;
    upc: string | null;
    epid: string | null;
    weight: { value: number; unit: string };
    dimensions: { length: number; width: number; height: number; unit: string };
    packageType: string;
  } | null;
  reverb: {
    make: string;
    model: string;
    title: string;
    categoryUuid: string;
    categoryName: string;
    conditionUuid: string;
    conditionName: string;
    year: string | null;
    finish: string | null;
    description: string;
  } | null;
}

export async function identifyItemsMulti(
  images: ImageInput[],
): Promise<DetailedVisionResult> {
  const prompt = images.length === 1
    ? 'Identify this item with multiple candidates and reasoning. Respond with ONLY valid JSON.'
    : `You are viewing ${images.length} photos of the SAME item from different angles. Cross-reference all photos to identify it precisely. Respond with ONLY valid JSON.`;

  const { text } = await analyzeImages(images, DETAILED_SYSTEM_PROMPT, prompt, {
    temperature: 0,
    maxTokens: 2048,
    validate: schemaValidator([
      { name: 'detailed', schema: DetailedVisionResultSchema },
      { name: 'single', schema: VisionResultSchema },
    ]),
  });

  const parsed = safeParseJSON(text);

  const detailed = DetailedVisionResultSchema.safeParse(parsed);
  if (detailed.success) return detailed.data;

  const single = VisionResultSchema.safeParse(parsed);
  if (single.success) {
    return {
      candidates: [{
        ...single.data,
        features: single.data.suggestedTags,
        confidence: 0.8,
      }],
      reasoning: Array.isArray((parsed as Record<string, unknown>).reasoning)
        ? (parsed as Record<string, unknown>).reasoning as string[]
        : ['Identified by visual analysis'],
    };
  }

  logger.warn({ detailedError: detailed.error.message, singleError: single.error.message }, 'AI multi-image scan returned invalid response');
  throw new AppError(502, 'AI_RESPONSE_INVALID', `AI multi-image scan returned invalid response — detailed: ${detailed.error.message}; single: ${single.error.message}`);
}

export async function fetchPhotosAsBase64(urls: string[], limit: number): Promise<ImageInput[]> {
  const selected = urls.slice(0, limit);
  const results: ImageInput[] = [];

  const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

  for (const url of selected) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn({ url, status: res.status }, 'Photo fetch returned non-OK status — skipping');
        continue;
      }
      const rawType = res.headers.get('content-type') || 'image/jpeg';
      const mediaType = rawType.split(';')[0].trim();
      if (!SUPPORTED_TYPES.has(mediaType)) {
        logger.warn({ url, mediaType }, 'Unsupported content-type for vision — skipping');
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      results.push({ base64: buffer.toString('base64'), mediaType });
    } catch (err) {
      logger.warn({ url, error: (err as Error).message }, 'Failed to fetch photo for vision — skipping');
    }
  }

  return results;
}

export async function generateListingFields(input: ListingFieldsInput): Promise<ListingFieldsOutput> {
  const userPrompt = `ITEM SCAN DATA:
${JSON.stringify(input.scanData, null, 2)}

EBAY CATEGORY SUGGESTION: ${JSON.stringify(input.ebayCategorySuggestion)}
${input.reverbCategories?.length ? `
REVERB CATEGORIES (when filling reverb fields, copy the single best-fitting full name from THIS LIST verbatim into reverb.categoryName — never invent a category; leave reverb.categoryUuid as ""; if nothing on the list fits, set reverb to null. Paths use " / " between levels: pick the DEEPEST path that confidently fits the item — prefer "Effects and Pedals / Distortion" over "Effects and Pedals"; when unsure between sibling subcategories, choose their parent path instead):
${input.reverbCategories.join('\n')}
` : ''}

REQUIRED ITEM SPECIFICS FOR THIS CATEGORY:
${JSON.stringify(input.requiredAspects, null, 2)}

SOLD COMPS (eBay): ${JSON.stringify(input.soldComps.slice(0, 10))}

ACTIVE COMPS (eBay): ${JSON.stringify(input.activeComps.slice(0, 10))}

REVERB COMPS: ${JSON.stringify(input.reverbComps.slice(0, 10))}

SELLER DEFAULTS: ${JSON.stringify(input.sellerDefaults)}

Generate all listing fields as JSON.`;

  const images = input.images?.length
    ? input.images
    : await fetchPhotosAsBase64(input.photoUrls, 5);

  let text: string;
  if (images.length > 0) {
    const result = await analyzeImages(images, LISTING_FIELDS_SYSTEM_PROMPT, userPrompt, {
      temperature: 0,
      maxTokens: 4096,
      validate: schemaValidator([{ name: 'listing-fields', schema: ListingFieldsOutputSchema }]),
    });
    text = result.text;
  } else {
    // chatText has no validate support — the photo-less path keeps parse-fail-as-502
    // behavior; only the vision chains fail over on schema-invalid output.
    const result = await chatText(LISTING_FIELDS_SYSTEM_PROMPT, userPrompt, { temperature: 0, maxTokens: 4096 });
    text = result.text;
  }

  const parsed = safeParseJSON(text);
  const validated = ListingFieldsOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError(502, 'AI_RESPONSE_INVALID', `AI listing fields returned invalid response: ${validated.error.message}`);
  }
  const fields = validated.data as ListingFieldsOutput;

  // Constrained second pass (burndown 3.4): high-cardinality enum aspects like
  // "Type" routinely come back unfilled from the single-shot call. Never throws.
  if (fields.ebay) {
    fields.ebay.aspects = await pickMissingRequiredAspects({
      aspects: fields.ebay.aspects ?? {},
      requiredAspects: input.requiredAspects,
      itemContext: {
        brand: input.scanData.brand,
        model: input.scanData.model,
        category: input.scanData.category,
        title: fields.ebay.title ?? fields.title ?? '',
      },
    });
  }
  return fields;
}
