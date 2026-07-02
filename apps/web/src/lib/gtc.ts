// Mirrors apps/api/src/lib/gtc-renewal.ts (shared package is type-only, so the
// small math is duplicated rather than adding runtime code there).
function anniversaryAfterMonths(publishedAt: Date, months: number): Date {
  const target = new Date(publishedAt.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

export function nextGtcRenewal(publishedAt: Date, now: Date = new Date()): Date {
  let months = 1;
  let candidate = anniversaryAfterMonths(publishedAt, months);
  while (candidate.getTime() <= now.getTime()) {
    months += 1;
    candidate = anniversaryAfterMonths(publishedAt, months);
  }
  return candidate;
}
