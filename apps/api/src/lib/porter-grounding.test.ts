import { validateGrounding, collectToolTitles } from './porter-grounding.js';

describe('validateGrounding', () => {
  it('throws when a listed item name matches no tool-returned title', () => {
    const titles = ['Hosa DTP-805 8-channel DB25 Snake', 'Impeto Fiber Optic Audio Cable'];
    const text = [
      'Here is what you own:',
      '- Hosa DTP-805 8-channel DB25 Snake — good, $99',
      '- Gibson Flying V — excellent, $1200',
    ].join('\n');

    expect(() => validateGrounding(text, titles)).toThrow(/Gibson Flying V/);
  });

  it('is a no-op when no titles were collected (no inventory tools ran)', () => {
    const text = '- Gibson Flying V — excellent, $1200';
    expect(() => validateGrounding(text, [])).not.toThrow();
  });

  it('catches hallucinated items in the comma format PORTER_SYSTEM mandates', () => {
    const titles = ['Hosa DTP-805 Snake'];
    const text = [
      '- Hosa DTP-805 Snake, good, $99',
      '- Gibson Flying V, excellent, $1200',
    ].join('\n');
    expect(() => validateGrounding(text, titles)).toThrow(/Gibson Flying V/);
  });

  it('does not flag advice lines whose name segment carries a price', () => {
    const titles = ['Hosa DTP-805 Snake'];
    const text = '- Price it at $450 — comps run $400-500';
    expect(() => validateGrounding(text, titles)).not.toThrow();
  });

  it('still flags hallucinations when some titles normalize to empty (emoji/CJK)', () => {
    const titles = ['★★★', 'Hosa DTP-805 Snake'];
    const text = '- Gibson Flying V — excellent, $1200';
    expect(() => validateGrounding(text, titles)).toThrow(/Gibson Flying V/);
  });

  it('does not flag summary-header lines like "Estimated Value" (live false positive 08-11)', () => {
    const titles = ['Hosa DTP-805 Snake'];
    const text = [
      '- Hosa DTP-805 Snake — good, $99',
      '- **Estimated Value** — $25–$35',
      '- Total Value Range: combined, $120–$150',
    ].join('\n');
    expect(() => validateGrounding(text, titles)).not.toThrow();
  });

  it('rejects a generic single-word name even when it appears inside a real title (A5)', () => {
    const titles = ['Fender Stratocaster Electric Guitar'];
    const text = '- Guitar — good, $500';
    expect(() => validateGrounding(text, titles)).toThrow(/Guitar/);
  });

  it('ignores summary/total lines that are not item entries', () => {
    const titles = ['Hosa DTP-805 Snake'];
    const text = [
      '- Hosa DTP-805 Snake — good, $99',
      '- Total estimated value: $1500',
    ].join('\n');
    expect(() => validateGrounding(text, titles)).not.toThrow();
  });
});

describe('collectToolTitles', () => {
  it('collects titles from search_inventory rows and suggest_listing results', () => {
    const titles: string[] = [];
    collectToolTitles('search_inventory', JSON.stringify([
      { id: '1', title: 'Hosa DTP-805 Snake' },
      { id: '2', title: 'Impeto Fiber Cable' },
    ]), titles);
    collectToolTitles('suggest_listing', JSON.stringify({ itemId: '1', suggestedTitle: 'Hosa Snake DB25' }), titles);
    collectToolTitles('search_inventory', 'No items found matching your criteria.', titles);

    expect(titles).toEqual(['Hosa DTP-805 Snake', 'Impeto Fiber Cable', 'Hosa Snake DB25']);
  });
});
