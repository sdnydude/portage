import type { ItemPhoto } from "@portage/shared";

/**
 * Array order is the canonical photo order everywhere (publish sends it
 * verbatim; index 0 is the hero). Six surfaces still resolve the hero as
 * `find(isPrimary) ?? photos[0]`, so every persist path must keep the flag
 * glued to index 0 — a stale `isPrimary` on a non-zero index makes the app
 * hero diverge from the marketplace hero.
 */
export function normalizePhotoOrder<T extends Pick<ItemPhoto, "isPrimary">>(photos: T[]): T[] {
  return photos.map((p, i) => ({ ...p, isPrimary: i === 0 }));
}

/** Immutable remove; result renormalized so isPrimary stays glued to index 0. */
export function removePhotoAt<T extends Pick<ItemPhoto, "isPrimary">>(photos: T[], index: number): T[] {
  return normalizePhotoOrder(photos.filter((_, i) => i !== index));
}

/** Immutable move; result renormalized so isPrimary stays glued to index 0. */
export function movePhoto<T extends Pick<ItemPhoto, "isPrimary">>(photos: T[], from: number, to: number): T[] {
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizePhotoOrder(next);
}
