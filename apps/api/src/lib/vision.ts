import { analyzeImage, chatText } from './ai-client.js';
import type { RecognitionCandidate } from '@portage/shared';

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
  );

  return JSON.parse(extractJSON(text)) as VisionResult;
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
  );

  const json = JSON.parse(extractJSON(text));

  if (!json.candidates || !Array.isArray(json.candidates) || json.candidates.length === 0) {
    const flat = json as VisionResult;
    return {
      candidates: [{
        name: flat.name,
        description: flat.description,
        category: flat.category,
        condition: flat.condition,
        conditionNotes: flat.conditionNotes,
        brand: flat.brand,
        model: flat.model,
        features: flat.suggestedTags,
        estimatedValueLow: flat.estimatedValueLow,
        estimatedValueHigh: flat.estimatedValueHigh,
        confidence: 0.8,
      }],
      reasoning: json.reasoning ?? ['Identified by visual analysis'],
    };
  }

  return {
    candidates: json.candidates,
    reasoning: json.reasoning ?? [],
  };
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

OUTPUT: JSON matching the schema provided. No markdown, no explanation — ONLY valid JSON.`;

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

export async function generateListingFields(input: ListingFieldsInput): Promise<ListingFieldsOutput> {
  const userPrompt = `ITEM SCAN DATA:
${JSON.stringify(input.scanData, null, 2)}

PHOTOS: ${JSON.stringify(input.photoUrls)}

EBAY CATEGORY SUGGESTION: ${JSON.stringify(input.ebayCategorySuggestion)}

REQUIRED ITEM SPECIFICS FOR THIS CATEGORY:
${JSON.stringify(input.requiredAspects, null, 2)}

SOLD COMPS (eBay): ${JSON.stringify(input.soldComps.slice(0, 10))}

ACTIVE COMPS (eBay): ${JSON.stringify(input.activeComps.slice(0, 10))}

REVERB COMPS: ${JSON.stringify(input.reverbComps.slice(0, 10))}

SELLER DEFAULTS: ${JSON.stringify(input.sellerDefaults)}

Generate all listing fields as JSON.`;

  const { text } = await chatText(LISTING_FIELDS_SYSTEM_PROMPT, userPrompt);

  return JSON.parse(extractJSON(text)) as ListingFieldsOutput;
}
