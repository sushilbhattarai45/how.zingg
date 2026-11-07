import { describe, expect, it } from 'vitest';
import { collectCallFacts, formatCallNotesChat, splitNotesIntoFacts } from '@/lib/callFacts';
import { parseCallSummaryBullets } from '@/lib/callSummarize';

describe('call summary bullets', () => {
  it('parses dashed lines from Gemini', () => {
    const bullets = parseCallSummaryBullets(
      '- Move-in available December 1\n- Apply online, then background check\nThanks!',
    );
    expect(bullets[0]).toMatch(/Move-in/);
    expect(bullets[1]).toMatch(/Apply online/);
    expect(bullets).toHaveLength(2);
  });

  it('splits notes into facts and formats chat', () => {
    const facts = splitNotesIntoFacts('- First fact here\n- Second fact here');
    expect(facts).toHaveLength(2);
    expect(formatCallNotesChat(facts)).toMatch(/Here's what I got from the call/);
    expect(formatCallNotesChat(facts)).toMatch(/• First fact/);
  });

  it('collects move-in / process speech when rent fields are missing', () => {
    const facts = collectCallFacts({
      status: 'done',
      transcript: [
        {
          speaker: 'office',
          text: 'You can move in next Friday. The application process is online, then we need a deposit.',
          at: 1,
        },
      ],
    });
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.join(' ')).toMatch(/move in|application|deposit/i);
  });
});
