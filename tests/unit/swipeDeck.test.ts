import { describe, expect, it } from 'vitest';
import { buildDeck, hiddenScams, tasksFor } from '@/lib/swipeDeck';

describe('swipe deck', () => {
  it('never shows scam listings', () => {
    const deck = buildDeck();
    expect(deck.some((c) => c.title.startsWith('Sunny'))).toBe(false);
    expect(hiddenScams()).toBe(1);
    expect(deck.length).toBeGreaterThan(3);
  });
  it('puts the closest walk first', () => {
    const deck = buildDeck();
    for (let i = 1; i < deck.length; i++)
      expect(deck[i]!.walkMin ?? 99).toBeGreaterThanOrEqual(deck[i - 1]!.walkMin ?? 99);
  });
  it('hands a yes to Caller, Packet and Closer, with both time zones for the call', () => {
    const [card] = buildDeck();
    const tasks = tasksFor(card!, 'Asia/Kathmandu', new Date('2027-07-14T14:00:00Z'));
    expect(tasks.map((t) => t.agent)).toEqual(['caller', 'packet', 'closer']);
    expect(tasks[0]!.text).toMatch(/9:00 AM CT \(.+ your time\)/);
  });
});
