import { describe, expect, it } from 'vitest';
import { answerExample } from '@/lib/askExample';

describe('example answers for Ask the team', () => {
  it('finds the cheapest 1 bed under a price cap and hides scams', () => {
    const a = answerExample('Cheapest 1 bed under $700 near USM');
    expect(a.kind).toBe('listings');
    expect(a.mood).toBe('happy');
    expect(a.results[0]!.title).toContain('Willow Park');
    expect(a.results.every((r) => !r.title.startsWith('Sunny'))).toBe(true);
    expect(a.hiddenScams).toBe(1);
  });
  it('never guesses live availability', () => {
    const a = answerExample("Is Oak Hollow's 1 bed free on Aug 14?");
    expect(a.kind).toBe('live');
    expect(a.say).toMatch(/live answer/);
  });
  it('is honest (and a little sad) when nothing matches', () => {
    const a = answerExample('1 bed under $300');
    expect(a.mood).toBe('sad');
    expect(a.results).toHaveLength(0);
  });
  it('answers place questions with sources', () => {
    const a = answerExample('Nearest Walmart from campus');
    expect(a.kind).toBe('places');
    expect(a.results[0]!.sourceUrl).toMatch(/^https:/);
  });
});
