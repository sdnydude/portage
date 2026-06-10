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
