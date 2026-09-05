// Porter grounding validation (Phase 3a, approved 2026-08-10).
// Post-tool-loop check that inventory items the model lists actually exist in
// tool-returned rows. Prompt-only grounding proved insufficient: qwen3:14b
// invented items in 2 of 3 runs on 2026-08-05 despite explicit anti-invention
// rules in PORTER_SYSTEM. A thrown error is treated as a failed provider call
// (retry once, then fail over — see AIOptions.validate).

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Accumulates item titles from a tool's raw string result into `titles`.
 *  Non-JSON results (e.g. "No items found…") are ignored. */
export function collectToolTitles(toolName: string, result: string, titles: string[]): void {
  let parsed: unknown;
  try { parsed = JSON.parse(result); } catch { return; }

  if (toolName === 'search_inventory' && Array.isArray(parsed)) {
    for (const row of parsed) {
      const title = (row as { title?: unknown }).title;
      if (typeof title === 'string' && title) titles.push(title);
    }
  } else if (toolName === 'suggest_listing' && parsed && typeof parsed === 'object') {
    const title = (parsed as { suggestedTitle?: unknown }).suggestedTitle;
    if (typeof title === 'string' && title) titles.push(title);
  }
}

/** Throws when `text` lists an item name that matches no tool-returned title.
 *  No-op when no titles were collected (no inventory tools ran this turn). */
export function validateGrounding(text: string, titles: string[]): void {
  if (titles.length === 0) return;
  // Titles that normalize to '' (emoji/CJK-only) would whitelist every name
  // via includes('') — drop them. If none survive, grounding can't run.
  const normTitles = titles.map(normalize).filter(Boolean);
  if (normTitles.length === 0) return;
  for (const line of text.split('\n')) {
    const m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (!m) continue;
    const body = m[1];
    // Item entries: "name — condition, value" or PORTER_SYSTEM's literal
    // "name, condition, estimated value" (≥3 comma segments with a price or
    // condition word). Summary lines ("Total estimated value: $x") match
    // neither shape — skip them.
    const hasDash = /[—–]/.test(body);
    const commaForm = body.split(',').length >= 3
      && /\$|\b(new|like.new|good|fair|poor|excellent|mint)\b/i.test(body);
    if (!hasDash && !commaForm) continue;
    const name = body.split(/[—–:]|,/)[0].replace(/\*\*|__|\*/g, '').trim();
    // Advice/summary phrasing, not an item name: prices live after the
    // separator in item entries, so a "$" in the name segment means prose.
    if (name.includes('$')) continue;
    // Summary/total header lines ("Estimated Value — $x", "Total Value Range")
    // are not item names — live false positive discarded a correct reply on
    // 2026-08-11 and the tool-less retry answered wrong.
    if (/^(estimated|total|combined|overall|value|price|range|summary|subtotal)\b/i.test(name)) continue;
    const normName = normalize(name);
    if (!normName) continue;
    // Word-set containment, not raw substring: every word of the shorter side
    // must appear in the longer, and a partial match needs ≥2 words — a lone
    // generic word ("guitar") inside a real title must not ground (A5).
    const nameWords = normName.split(' ');
    const grounded = normTitles.some(t => {
      if (t === normName) return true;
      const titleWords = t.split(' ');
      const nameInTitle = nameWords.length >= 2 && nameWords.every(w => titleWords.includes(w));
      const titleInName = titleWords.length >= 2 && titleWords.every(w => nameWords.includes(w));
      return nameInTitle || titleInName;
    });
    if (!grounded) {
      throw new Error(`Ungrounded item in Porter reply: "${name}" not in tool results`);
    }
  }
}
