import { describe, expect, it } from 'vitest';
import { formatGuideReply, parseYesNo } from '@/lib/chatFormat';

describe('chatFormat', () => {
  it('turns paragraphs into bullets and extracts CALL_OFFER', () => {
    const { text, callOffer } = formatGuideReply(
      'The place is near campus. Rent is not in the doc.\nCALL_OFFER: What is studio rent?',
    );
    expect(text).toMatch(/^• /m);
    expect(text).toMatch(/Want me to call/);
    expect(callOffer).toMatch(/studio rent/i);
  });

  it('ignores CALL_OFFER none', () => {
    const { callOffer, text } = formatGuideReply('- Walk is 6 min\nCALL_OFFER: none');
    expect(callOffer).toBeNull();
    expect(text).toMatch(/Walk is 6 min/);
    expect(text).not.toMatch(/Want me to call/);
  });

  it('parses yes/no', () => {
    expect(parseYesNo('yes')).toBe('yes');
    expect(parseYesNo('no thanks')).toBe('no');
    expect(parseYesNo('maybe later')).toBeNull();
  });
});
