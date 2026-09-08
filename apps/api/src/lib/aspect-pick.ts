import { chatText } from './ai-client.js';
import { createLogger } from './logger.js';

const logger = createLogger('aspect-pick');

export interface MissingEnumAspect {
  name: string;
  values: string[];
  cardinality: 'SINGLE' | 'MULTI';
}

export interface PickAspectsInput {
  aspects: Record<string, string[]>;
  requiredAspects: Record<string, { required: boolean; values: string[] | null; cardinality?: 'SINGLE' | 'MULTI' }>;
  itemContext: { brand: string; model: string; category: string; title: string };
}

// Cardinality parity with the listing-fields prompt: SINGLE aspects take one
// value, MULTI aspects (Features, Connectivity…) take every applicable one.
const PICK_SYSTEM_PROMPT = `You classify a product into marketplace item-specific values.
For EVERY aspect listed, choose from that aspect's ALLOWED VALUES only — never invent a value, never leave an aspect out.
Aspects marked SINGLE: reply with exactly one value string — the closest match for the item.
Aspects marked MULTI: reply with an array of EVERY allowed value that applies to the item.
Reply with ONLY a JSON object mapping each aspect name to its value (string for SINGLE, array for MULTI). No markdown, no explanation.`;

// Enums beyond this size (e.g. Brand with 844 suggested values) aren't a
// classification task — sending them bloats the prompt and starves thinking
// models of output tokens (observed live: qwen3 spent the whole budget on
// reasoning and returned empty content). The pick pass only handles
// pill-sized enums like Type / Form Factor.
const MAX_ENUM_VALUES = 120;

export async function pickMissingRequiredAspects(
  input: PickAspectsInput,
): Promise<Record<string, string[]>> {
  const missing = findMissingEnumAspects(input.aspects, input.requiredAspects)
    .filter((m) => m.values.length <= MAX_ENUM_VALUES);
  if (missing.length === 0) return input.aspects;

  const userPrompt = `ITEM:
${JSON.stringify(input.itemContext, null, 2)}

ASPECTS TO CLASSIFY:
${missing.map((m) => `- "${m.name}" (${m.cardinality}) — ALLOWED VALUES: ${JSON.stringify(m.values)}`).join('\n')}

SINGLE → one value; MULTI → array of every applicable value. JSON object only.`;

  let text: string;
  try {
    // Thinking models spend completion tokens on reasoning before any content —
    // 512 was observed to produce empty content live; give real headroom.
    ({ text } = await chatText(PICK_SYSTEM_PROMPT, userPrompt, { temperature: 0, maxTokens: 2048 }));
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Aspect pick call failed — keeping aspects unchanged');
    return input.aspects;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
  } catch {
    logger.warn({ text: text.slice(0, 200) }, 'Aspect pick returned non-JSON — keeping aspects unchanged');
    return input.aspects;
  }
  if (typeof parsed !== 'object' || parsed === null) return input.aspects;

  const filled = { ...input.aspects };
  for (const { name, values, cardinality } of missing) {
    const raw = (parsed as Record<string, unknown>)[name];
    const picks = Array.isArray(raw) ? raw : [raw];
    // Map back to the canonical enum casing; drop picks outside the enum.
    const canonical = picks
      .filter((p): p is string => typeof p === 'string')
      .map((p) => values.find((v) => v.toLowerCase() === p.trim().toLowerCase()))
      .filter((v): v is string => Boolean(v));
    if (canonical.length === 0) continue;
    filled[name] = cardinality === 'MULTI' ? [...new Set(canonical)] : [canonical[0]];
  }
  return filled;
}

export function findMissingEnumAspects(
  aspects: Record<string, string[]>,
  requiredAspects: Record<string, { required: boolean; values: string[] | null; cardinality?: 'SINGLE' | 'MULTI' }>,
): MissingEnumAspect[] {
  const missing: MissingEnumAspect[] = [];
  for (const [name, spec] of Object.entries(requiredAspects)) {
    if (!spec.required || !spec.values || spec.values.length === 0) continue;
    const allowed = new Set(spec.values.map((v) => v.toLowerCase()));
    const filled = aspects[name];
    const hasValidValue = (filled ?? []).some((v) => allowed.has(v.toLowerCase()));
    if (!hasValidValue) {
      missing.push({ name, values: spec.values, cardinality: spec.cardinality ?? 'SINGLE' });
    }
  }
  return missing;
}
