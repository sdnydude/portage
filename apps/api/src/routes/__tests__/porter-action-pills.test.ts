import { parseActionPills, PORTER_SYSTEM } from '../porter.js';

describe('parseActionPills', () => {
  it('extracts pills array from <actions> block', () => {
    const text = 'Here are some options. <actions>[{"label":"Check inventory","message":"show me my inventory"},{"label":"Get stats","message":"inventory stats"}]</actions>';
    const result = parseActionPills(text);
    expect(result.pills).toEqual([
      { label: 'Check inventory', message: 'show me my inventory' },
      { label: 'Get stats', message: 'inventory stats' },
    ]);
    expect(result.cleanText).toBe('Here are some options. ');
  });

  it('filters pills with oversized label or message fields', () => {
    const longLabel = 'x'.repeat(51);
    const longMsg = 'x'.repeat(501);
    const text = `<actions>[{"label":"${longLabel}","message":"ok"},{"label":"ok","message":"${longMsg}"},{"label":"Valid","message":"go"}]</actions>`;
    const result = parseActionPills(text);
    expect(result.pills).toEqual([{ label: 'Valid', message: 'go' }]);
  });

  it('system prompt includes action pills format instructions', () => {
    expect(PORTER_SYSTEM).toContain('<actions>');
    expect(PORTER_SYSTEM).toContain('"label"');
    expect(PORTER_SYSTEM).toContain('"message"');
  });
});
