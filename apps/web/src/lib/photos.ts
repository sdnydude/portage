/**
 * Array order is the canonical photo order everywhere (publish sends it
 * verbatim; index 0 is the hero). Six surfaces still resolve the hero as
 * `find(isPrimary) ?? photos[0]`, so every persist path must keep the flag
 * glued to index 0 — a stale `isPrimary` on a non-zero index makes the app
 * hero diverge from the marketplace hero.
 */
export function normalizePhotoOrder<T extends object>(photos: T[]): T[] {
  // Photo shapes without isPrimary (e.g. scan-flow's CapturedPhoto) pass
  // through here too — the added flag is inert until the item is created.
  return photos.map((p, i) => ({ ...p, isPrimary: i === 0 }) as T);
}

/** Immutable remove; result renormalized so isPrimary stays glued to index 0. */
export function removePhotoAt<T extends object>(photos: T[], index: number): T[] {
  if (index < 0 || index >= photos.length) return photos;
  return normalizePhotoOrder(photos.filter((_, i) => i !== index));
}

/** Immutable move; result renormalized so isPrimary stays glued to index 0. */
export function movePhoto<T extends object>(photos: T[], from: number, to: number): T[] {
  // Out-of-range indices (stale event after a concurrent mutation) must not
  // splice undefined holes into the array — return the input untouched.
  if (from < 0 || from >= photos.length || to < 0 || to >= photos.length) return photos;
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizePhotoOrder(next);
}
