import { chatText } from './ai-client.js';
import { createLogger } from './logger.js';

const logger = createLogger('aspect-pick');

export interface MissingEnumAspect {
  name: string;
  values: string[];
}

export interface PickAspectsInput {
  aspects: Record<string, string[]>;
  requiredAspects: Record<string, { required: boolean; values: string[] | null }>;
  itemContext: { brand: string; model: string; category: string; title: string };
}

const PICK_SYSTEM_PROMPT = `You classify a product into marketplace item-specific values.
For EVERY aspect listed, pick EXACTLY ONE value from that aspect's ALLOWED VALUES — the closest match for the item. Never invent a value, never leave one out.
Reply with ONLY a JSON object mapping each aspect name to the chosen value string. No markdown, no explanation.`;

export async function pickMissingRequiredAspects(
  input: PickAspectsInput,
): Promise<Record<string, string[]>> {
  const missing = findMissingEnumAspects(input.aspects, input.requiredAspects);
  if (missing.length === 0) return input.aspects;

  const userPrompt = `ITEM:
${JSON.stringify(input.itemContext, null, 2)}

ASPECTS TO CLASSIFY:
${missing.map((m) => `- "${m.name}" — ALLOWED VALUES: ${JSON.stringify(m.values)}`).join('\n')}

Pick one allowed value per aspect. JSON object only.`;

  let text: string;
  try {
    ({ text } = await chatText(PICK_SYSTEM_PROMPT, userPrompt, { temperature: 0, maxTokens: 512 }));
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
  for (const { name, values } of missing) {
    const raw = (parsed as Record<string, unknown>)[name];
    if (typeof raw !== 'string') continue;
    // Map back to the canonical enum casing; drop picks outside the enum.
    const canonical = values.find((v) => v.toLowerCase() === raw.trim().toLowerCase());
    if (canonical) filled[name] = [canonical];
  }
  return filled;
}

export function findMissingEnumAspects(
  aspects: Record<string, string[]>,
  requiredAspects: Record<string, { required: boolean; values: string[] | null }>,
): MissingEnumAspect[] {
  const missing: MissingEnumAspect[] = [];
  for (const [name, spec] of Object.entries(requiredAspects)) {
    if (!spec.required || !spec.values || spec.values.length === 0) continue;
    const allowed = new Set(spec.values.map((v) => v.toLowerCase()));
    const filled = aspects[name];
    const hasValidValue = (filled ?? []).some((v) => allowed.has(v.toLowerCase()));
    if (!hasValidValue) {
      missing.push({ name, values: spec.values });
    }
  }
  return missing;
}
