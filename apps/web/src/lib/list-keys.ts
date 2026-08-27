/**
 * Pair list items with stable React keys without falling back to the array
 * index. `keyOf` names the item's natural identity (a URL, a label, a content
 * string); repeats get an occurrence suffix so identical items never collide.
 * Render with `withKeys(items, keyOf).map(([key, item]) => <X key={key} … />)`.
 */
export function withKeys<T>(items: readonly T[], keyOf: (item: T) => string): Array<[string, T]> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return [n === 1 ? base : `${base}#${n}`, item];
  });
}
