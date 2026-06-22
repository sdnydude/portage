import type { RequiredAspect } from "@/hooks/use-required-aspects";

// Deterministic suggestion seeding: matches eBay-ENUMERATED aspect values against the
// item's own scan text. Cannot hallucinate — only values eBay itself allows, only when
// literally present in the text. Suggestions, never fills: UI requires tap-to-confirm.

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function suggestAspectValues(
  itemText: string,
  aspects: Record<string, RequiredAspect>,
): Record<string, string[]> {
  if (itemText.trim() === "") return {};
  const suggestions: Record<string, string[]> = {};
  for (const [name, aspect] of Object.entries(aspects)) {
    if (aspect.values === null) continue; // free-text aspects: nothing to enumerate
    const matches = aspect.values.filter((value) =>
      // Word-boundary match so "Red" never matches "Shredder". Lookarounds
      // instead of \b because \b fails on values with non-alphanumeric edges
      // (e.g. "A+": no \b between "+" and a following space).
      new RegExp(
        `(?<![A-Za-z0-9])${escapeRegex(value)}(?![A-Za-z0-9])`,
        "i",
      ).test(itemText),
    );
    if (matches.length > 0) suggestions[name] = matches;
  }
  return suggestions;
}

export interface MergedSuggestions {
  /** name → suggested values, for unconfirmed required aspects only. */
  suggestions: Record<string, string[]>;
  /** subset of suggestion names whose values came from the AI scan (Phase A). */
  aiNames: string[];
}

/**
 * Merge the AI's scan-filled aspects (Phase A `candidate.aspects`, category-aware)
 * with the deterministic text-matched seeds. AI values win per aspect and are
 * flagged in `aiNames` so the UI can tag them `[AI]`. Only unconfirmed required
 * aspects (present in the schema, empty in aspectValues) are surfaced.
 */
export function mergeAspectSuggestions(
  aiAspects: Record<string, string[]> | undefined,
  seeded: Record<string, string[]>,
  aspects: Record<string, RequiredAspect>,
  aspectValues: Record<string, string>,
): MergedSuggestions {
  const suggestions: Record<string, string[]> = {};
  const aiNames: string[] = [];
  for (const name of Object.keys(aspects)) {
    if ((aspectValues[name] ?? "").trim() !== "") continue; // already confirmed
    const raw = aiAspects?.[name];
    const ai = (Array.isArray(raw) ? raw : []).filter((v) => v.trim() !== "");
    if (ai.length > 0) {
      suggestions[name] = ai;
      aiNames.push(name);
    } else if (seeded[name]) {
      suggestions[name] = seeded[name];
    }
  }
  return { suggestions, aiNames };
}
