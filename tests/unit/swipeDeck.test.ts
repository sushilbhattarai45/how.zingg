import { describe, expect, it } from 'vitest';
import { buildDeck, hiddenScams, tasksFor } from '@/lib/swipeDeck';

describe('swipe deck', () => {
  it('returns hardcoded USM places with images', () => {
    const deck = buildDeck('Scianna Hall, Hattiesburg');
    expect(deck.length).toBeGreaterThan(3);
    expect(deck.every((c) => c.image.startsWith('/places/'))).toBe(true);
    expect(hiddenScams()).toBe(0);
  });
  it('puts the closest walk first by default', () => {
    const deck = buildDeck();
    for (let i = 1; i < deck.length; i++)
      expect(deck[i]!.walkMin ?? 99).toBeGreaterThanOrEqual(deck[i - 1]!.walkMin ?? 99);
  });
  it('hands a yes to Caller, Packet and Closer', () => {
    const [card] = buildDeck();
    const tasks = tasksFor(card!, 'Asia/Kathmandu', new Date('2027-07-14T14:00:00Z'));
    expect(tasks.map((t) => t.agent)).toEqual(['caller', 'packet', 'closer']);
    expect(tasks[0]!.text).toMatch(/DEMO_CALL_TO/i);
  });
});
