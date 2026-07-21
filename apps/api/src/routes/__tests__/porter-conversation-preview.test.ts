import { describe, it, expect } from 'vitest';
import { conversationPreview } from '../porter.js';

describe('conversationPreview', () => {
  it('returns the first user message text', () => {
    const messages = [
      { role: 'user', blocks: [{ type: 'text', text: 'How do I price my camera?' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'Let me check comps.' }] },
    ];

    expect(conversationPreview(messages)).toBe('How do I price my camera?');
  });
});
