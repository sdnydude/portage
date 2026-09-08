import { and, ilike, or, sql, type SQL } from 'drizzle-orm';
import { items } from '../db/schema.js';

/**
 * Porter inventory search. The old tool matched the whole query as one
 * substring of the title, so "sennheiser 148" missed "Sennheiser MKE 600 …
 * (148)" and a hyphen or extra space broke everything (live 2026-09-06).
 * Now: split into words, every word must appear in title, brand, model or
 * description.
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** AND over words, each word OR over the searchable columns. null when no words. */
export function inventorySearchConditions(query: string): SQL | null {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;
  const perWord = tokens.map((t) => {
    const like = `%${escapeLike(t)}%`;
    return or(
      ilike(items.title, like),
      ilike(items.brand, like),
      ilike(items.model, like),
      ilike(items.description, like),
    );
  });
  return and(...perWord) ?? null;
}

// Whole-title similarity() dilutes a short misspelled token across the rest
// of a long title (live check 2026-09-08: real Sennheiser titles scored
// 0.05-0.11 against "sennal 148", all under a 0.3 threshold). Per-token
// word_similarity() against the same titles scored 0.571.
const FUZZY_TOKEN_THRESHOLD = 0.4;
const MIN_FUZZY_TOKEN_LEN = 3;

function fuzzyTokens(query: string): string[] {
  // Numeric tokens like "148" matter for model numbers — only drop tokens
  // too short to mean anything (1-2 chars).
  return tokenizeQuery(query).filter((t) => t.length >= MIN_FUZZY_TOKEN_LEN);
}

/**
 * Trigram fallback (pg_trgm) for typo'd searches that word matching misses
 * entirely, e.g. "sennal 148" for "Sennheiser". Callers run this only when
 * the word-match search returns nothing. OR across tokens — a title needs
 * only one close token match, not all of them.
 */
export function fuzzyTitleCondition(query: string): SQL | null {
  const tokens = fuzzyTokens(query);
  if (tokens.length === 0) return null;
  const perToken = tokens.map((t) => sql`word_similarity(${t}, ${items.title}) > ${FUZZY_TOKEN_THRESHOLD}`);
  return or(...perToken) ?? null;
}

/** Order fuzzy fallback results by the closest-matching token, best first. */
export function fuzzyTitleOrder(query: string): SQL {
  const tokens = fuzzyTokens(query);
  const scores = tokens.length > 0
    ? tokens.map((t) => sql`word_similarity(${t}, ${items.title})`)
    : [sql`0`];
  return sql`greatest(${sql.join(scores, sql`, `)}) desc`;
}
