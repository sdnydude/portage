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

export function shouldAutoEnd(publishedAt: Date, now: Date, windowDays = 2): boolean {
  const renewal = nextRenewalDate(publishedAt, now);
  return renewal.getTime() - now.getTime() <= windowDays * 24 * 60 * 60 * 1000;
}

export function nextRenewalDate(publishedAt: Date, now: Date): Date {
  let months = 1;
  let candidate = anniversaryAfterMonths(publishedAt, months);
  while (candidate.getTime() <= now.getTime()) {
    months += 1;
    candidate = anniversaryAfterMonths(publishedAt, months);
  }
  return candidate;
}
