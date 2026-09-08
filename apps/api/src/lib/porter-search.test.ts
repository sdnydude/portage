import { tokenizeQuery, fuzzyTitleCondition, fuzzyTitleOrder } from './porter-search.js';

describe('tokenizeQuery', () => {
  it('splits on whitespace and hyphens, lowercases, and drops empty tokens so "sennal 148-xu" matches by word not by exact substring', () => {
    expect(tokenizeQuery('  Sennheiser  148-XU ')).toEqual(['sennheiser', '148', 'xu']);
  });
});

function sqlText(built: unknown): string {
  if (!built || typeof built !== 'object') return '';
  const chunks = (built as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return '';
  return chunks
    .map((c) => {
      if (c && typeof c === 'object' && Array.isArray((c as { value?: unknown }).value)) {
        return (c as { value: string[] }).value.join('');
      }
      if (c && typeof c === 'object' && Array.isArray((c as { queryChunks?: unknown }).queryChunks)) {
        return sqlText(c);
      }
      return '';
    })
    .join('');
}

describe('fuzzyTitleCondition', () => {
  it('builds a per-token word_similarity fallback, not a whole-title similarity guard (live check 2026-09-08: whole-title similarity for real Sennheiser titles measured 0.05-0.11, all under the 0.3 threshold, so that guard returned zero rows for the query it was built for)', () => {
    const text = sqlText(fuzzyTitleCondition('sennal 148'));
    expect(text).toContain('word_similarity');
    expect(text).not.toMatch(/(?<!word_)similarity\(/);
  });
});

describe('fuzzyTitleOrder', () => {
  it('orders by the greatest per-token word_similarity so the closest token match sorts first', () => {
    const text = sqlText(fuzzyTitleOrder('sennal 148'));
    expect(text).toContain('greatest(');
    expect(text).toContain('word_similarity');
    expect(text).toContain('desc');
  });
});
