import { describe, it, expect } from 'vitest';
import { applyFooter, descriptionLimitFor } from './footer.js';

describe('descriptionLimitFor', () => {
  it('returns the documented eBay HTML limit and a conservative default elsewhere', () => {
    expect(descriptionLimitFor('ebay')).toBe(500000);
    expect(descriptionLimitFor('etsy')).toBe(50000);
    expect(descriptionLimitFor('reverb')).toBe(50000);
  });
});

describe('applyFooter', () => {
  it('appends the footer after a blank line', () => {
    expect(applyFooter('Great vintage amp.', 'Ships fast from a smoke-free studio.', 1000))
      .toBe('Great vintage amp.\n\nShips fast from a smoke-free studio.');
  });

  it('is idempotent — re-applying on update does not duplicate the footer', () => {
    const once = applyFooter('Great vintage amp.', 'Ships fast.', 1000);
    expect(applyFooter(once, 'Ships fast.', 1000)).toBe(once);
  });

  it('skips the footer (never truncates the description) when the marketplace limit would be exceeded', () => {
    const description = 'x'.repeat(95);
    expect(applyFooter(description, 'a footer', 100)).toBe(description);
  });
});
