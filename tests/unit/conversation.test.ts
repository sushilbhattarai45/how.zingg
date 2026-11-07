import { describe, expect, it } from 'vitest';
import { buildDeck } from '@/lib/swipeDeck';
import { formatDuration, replyTo, scriptFor, STEPS } from '@/lib/conversation';

const opts = { userTz: 'Asia/Kathmandu', moveIn: '2027-08-14', now: new Date('2027-07-14T14:00:00Z') };

describe('place conversation', () => {
  const card = buildDeck()[0]!;

  it('walks through the agents in order and moves the progress forward', () => {
    const s = scriptFor(card, opts);
    expect(s.map((l) => l.from)).toEqual([
      'scout',
      'concierge',
      'caller',
      'caller',
      'caller',
      'caller',
      'packet',
      'closer',
    ]);
    expect(s.every((l, i) => i === 0 || l.step >= s[i - 1]!.step)).toBe(true);
    expect(s.at(-1)!.step).toBeLessThan(STEPS.length);
  });

  it('logs a call with its duration, an email, and a scheduled call in both time zones', () => {
    const s = scriptFor(card, opts);
    const calls = s.flatMap((l) => (l.log?.kind === 'call' ? [l.log] : []));
    expect(calls.map((c) => c.outcome)).toEqual(['voicemail', 'scheduled']);
    expect(calls[0]!.durationSec).toBeGreaterThan(0);
    expect(calls[1]!.when).toMatch(/9:00 AM CT \(.+ your time\)/);
    expect(s.some((l) => l.log?.kind === 'email')).toBe(true);
    expect(s.some((l) => l.text.includes('Aug 14'))).toBe(true);
  });

  it('formats call durations', () => {
    expect(formatDuration(52)).toBe('0:52');
    expect(formatDuration(247)).toBe('4:07');
    expect(formatDuration(3730)).toBe('1:02:10');
  });

  it('never guesses live answers when you ask', () => {
    expect(replyTo('Is it available on Aug 14?', card)).toMatch(/won't guess/);
  });
});
