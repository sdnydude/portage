import { z } from 'zod';
import { analyzeImage, analyzeImages, chatText } from './ai-client.js';
import { createLogger } from './logger.js';
import type { ImageInput } from './ai-client.js';
import { AppError } from '../middleware/error.js';
import type { RecognitionCandidate } from '@portage/shared';

const logger = createLogger('vision');

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

const VisionResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  condition: z.string().transform(normalizeCondition),
  conditionNotes: z.string().optional().default(''),
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
  conditionNotes: z.string().optional().default(''),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  features: z.array(z.string()).optional().default([]),
  estimatedValueLow: z.number(),
  estimatedValueHigh: z.number(),
  confidence: z.number().min(0).max(1),
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
    aspects: z.record(z.string(), z.unknown()).optional().default({}),
    upc: z.string().nullable().optional().default(null),
    epid: z.string().nullable().optional().default(null),
    weight: z.object({ value: z.number(), unit: z.string() }).optional().default({ value: 0, unit: 'oz' }),
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
    year: z.string().nullable().optional().default(null),
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

export async function identifyItem(imageBase64: string, mediaType: string): Promise<VisionResult> {
  const { text } = await analyzeImage(
    imageBase64,
    mediaType,
    SYSTEM_PROMPT,
    'Identify this item for marketplace listing. Respond with ONLY a JSON object, no other text.',
    { temperature: 0, maxTokens: 2048 },
  );

  const parsed = JSON.parse(extractJSON(text));
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
  - estimatedValueLow (int), estimatedValueHigh (int)
  - confidence (float 0-1, your confidence this is the correct identification)
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
    { temperature: 0, maxTokens: 2048 },
  );

  const parsed = JSON.parse(extractJSON(text));

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

  throw new AppError(502, 'AI_RESPONSE_INVALID', `AI detailed scan returned invalid response: ${detailed.error.message}`);
}

const LISTING_FIELDS_SYSTEM_PROMPT = `You are a marketplace listing expert. Generate production-quality fields for selling a used item on eBay and optionally Reverb.

RULES:
- eBay title must be ≤80 characters. Pack keywords: Brand + Model + Key Attributes + Condition hint
- Fill ALL required item specifics from the provided aspects list. Use "N/A" only as last resort.
- Condition description must reference specific wear visible in photos (scratches, scuffs, patina, etc.)
- If no wear is visible, say "Item appears to be in [condition] condition with no visible wear."
- Price suggestion should target slightly below sold median for faster sale
- Weight and dimensions are visual estimates — always flag as estimated
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
  "ebay": { "title": "≤80 char eBay title", "categoryId": "", "categoryName": "", "condition": "", "conditionDescription": "", "aspects": {}, "upc": null, "epid": null, "weight": {"value":0,"unit":"oz"}, "dimensions": {"length":0,"width":0,"height":0,"unit":"in"}, "packageType": "LETTER" },
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
  ebayCategorySuggestion: { categoryId: string; categoryName: string } | null;
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

  const { text } = await analyzeImages(images, DETAILED_SYSTEM_PROMPT, prompt, { temperature: 0, maxTokens: 2048 });

  const parsed = JSON.parse(extractJSON(text));

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
      const rawType = res.headers.get('content-type') || 'image/webp';
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

REQUIRED ITEM SPECIFICS FOR THIS CATEGORY:
${JSON.stringify(input.requiredAspects, null, 2)}

SOLD COMPS (eBay): ${JSON.stringify(input.soldComps.slice(0, 10))}

ACTIVE COMPS (eBay): ${JSON.stringify(input.activeComps.slice(0, 10))}

REVERB COMPS: ${JSON.stringify(input.reverbComps.slice(0, 10))}

SELLER DEFAULTS: ${JSON.stringify(input.sellerDefaults)}

Generate all listing fields as JSON.`;

  const images = await fetchPhotosAsBase64(input.photoUrls, 5);

  let text: string;
  if (images.length > 0) {
    const result = await analyzeImages(images, LISTING_FIELDS_SYSTEM_PROMPT, userPrompt, { temperature: 0, maxTokens: 4096 });
    text = result.text;
  } else {
    const result = await chatText(LISTING_FIELDS_SYSTEM_PROMPT, userPrompt, { temperature: 0, maxTokens: 4096 });
    text = result.text;
  }

  const parsed = JSON.parse(extractJSON(text));
  const validated = ListingFieldsOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError(502, 'AI_RESPONSE_INVALID', `AI listing fields returned invalid response: ${validated.error.message}`);
  }
  return validated.data as ListingFieldsOutput;
}
