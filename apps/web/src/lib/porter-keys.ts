import type { RichMessage } from "@portage/shared";

/**
 * Stable React keys for Porter messages, which carry no id (the API returns
 * role + blocks only). Keyed by content, suffixed by occurrence so identical
 * repeats stay unique; append-only conversations keep every key stable.
 * Build once per messages array (useMemo) and look up by object identity.
 */
export function messageKeys(messages: RichMessage[]): Map<RichMessage, string> {
  const seen = new Map<string, number>();
  const keys = new Map<RichMessage, string>();
  for (const msg of messages) {
    const base = `${msg.role}:${JSON.stringify(msg.blocks)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    keys.set(msg, `${base}#${n}`);
  }
  return keys;
}
