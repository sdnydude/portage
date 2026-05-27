import { describe, it, expect } from 'vitest';
import { normalizeConversationMessages } from '../porter.js';

describe('normalizeConversationMessages', () => {
  it('wraps legacy string-content messages as TextBlock array', () => {
    const legacy = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = normalizeConversationMessages(legacy);
    expect(result).toEqual([
      { role: 'user', blocks: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'Hi there' }] },
    ]);
  });

  it('passes through messages that already have blocks', () => {
    const modern = [
      { role: 'user', blocks: [{ type: 'text', text: 'Hi' }] },
    ];
    const result = normalizeConversationMessages(modern);
    expect(result).toEqual(modern);
  });

  it('handles empty messages array', () => {
    expect(normalizeConversationMessages([])).toEqual([]);
  });

  it('handles mixed legacy and modern messages', () => {
    const mixed = [
      { role: 'user', content: 'Old message' },
      { role: 'assistant', blocks: [{ type: 'text', text: 'New reply' }] },
    ];
    const result = normalizeConversationMessages(mixed);
    expect(result[0]).toEqual({ role: 'user', blocks: [{ type: 'text', text: 'Old message' }] });
    expect(result[1]).toEqual({ role: 'assistant', blocks: [{ type: 'text', text: 'New reply' }] });
  });

  it('normalizes messages saved in new blocks format without losing data', () => {
    const saved = [
      { role: 'user', blocks: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'Hi' }] },
    ];
    const result = normalizeConversationMessages(saved);
    expect(result).toEqual(saved);
  });
});
