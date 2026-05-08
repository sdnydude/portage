import { analyzeImage } from './ai-client.js';
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
