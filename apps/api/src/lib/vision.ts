import Anthropic from '@anthropic-ai/sdk';
import { pino } from 'pino';
import { env } from './env.js';

const logger = pino({ name: 'vision' });

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY! });
  }
  return _client;
}

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

export async function identifyItem(imageBase64: string, mediaType: string): Promise<VisionResult> {
  const startTime = Date.now();

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBase64,
            },
          },
          { type: 'text', text: 'Identify this item for marketplace listing.' },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const elapsed = Date.now() - startTime;

  logger.info({
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    elapsed,
  }, 'Vision analysis complete');

  const result = JSON.parse(text) as VisionResult;
  return result;
}
