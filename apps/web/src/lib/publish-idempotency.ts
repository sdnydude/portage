// Dedup key for POST /listings, scoped as `${itemId}:${marketplace}:${random}`.
// Reuse `current` while it targets the same item+marketplace so a retry collides
// on the server's (userId, idempotencyKey) unique index and resumes the stuck
// row instead of inserting an orphan draft per attempt; any other target mints
// a fresh key. Callers clear their stored key after a successful publish.
export function scopedPublishIdempotencyKey(
  itemId: string,
  marketplace: string,
  current?: string | null,
): string {
  const scope = `${itemId}:${marketplace}:`;
  if (current?.startsWith(scope)) return current;
  // crypto.randomUUID requires a secure context (HTTPS/localhost); plain-HTTP
  // LAN dev must fall back rather than crash the publish.
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${scope}${random}`;
}
