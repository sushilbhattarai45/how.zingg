import { describe, expect, it } from 'vitest';
import { buildDeck } from '@/lib/swipeDeck';
import {
  collectCallFacts,
  extractCallQuestions,
  formatDuration,
  handleChatTurn,
  messagesFromCallHistory,
  parseCallWhen,
  replyTo,
  scriptFor,
  STEPS,
  summarizeCallForChat,
} from '@/lib/conversation';

const opts = { userTz: 'Asia/Kathmandu', moveIn: '2027-08-14', now: new Date('2027-07-14T14:00:00Z') };

describe('place conversation', () => {
  const card = buildDeck()[0]!;

  it('only posts add + schedule CTA — no fake voicemail/email demo', () => {
    const s = scriptFor(card, opts);
    expect(s.map((l) => l.from)).toEqual(['scout', 'concierge', 'caller']);
    expect(s[0]!.text).toMatch(/Added to your list/i);
    expect(s.some((l) => l.action === 'schedule-call')).toBe(true);
    expect(s.every((l) => !l.log)).toBe(true);
    expect(s.at(-1)!.step).toBeLessThan(STEPS.length);
  });

  it('formats call durations', () => {
    expect(formatDuration(52)).toBe('0:52');
    expect(formatDuration(247)).toBe('4:07');
    expect(formatDuration(3730)).toBe('1:02:10');
  });

  it('never guesses live answers when you ask — steers you to call-and-ask', () => {
    expect(replyTo('Is it available on Aug 14?', card)).toMatch(/call and ask|live answer/i);
  });

  it('extracts call questions and asks when, then dials on a when-reply', () => {
    const ask = handleChatTurn('call and ask if pets are allowed', card, null);
    expect(ask.pendingAsk?.questions[0]).toMatch(/pets/i);
    expect(ask.action).toBe('pick-call-when');
    expect(ask.reply).toMatch(/When should I call/i);

    expect(parseCallWhen('in 5 min')).toBe(5);
    expect(parseCallWhen('now')).toBe(0);

    const dial = handleChatTurn('5 min', card, ask.pendingAsk!);
    expect(dial.dial).toEqual({ delayMinutes: 5, questions: ask.pendingAsk!.questions });
    expect(dial.from).toBe('caller');
    const about = extractCallQuestions('call them about parking');
    expect(about?.[0]).toMatch(/parking/i);
  });

  it('turns multiple calls for one place into messenger logs + summaries', () => {
    const msgs = messagesFromCallHistory(
      [
        {
          callId: 'c1',
          placeSlug: card.slug,
          placeTitle: card.title,
          status: 'done',
          startedAt: 1_000,
          endedAt: 61_000,
          transcript: [{ speaker: 'office', text: 'Rent is 650 a month', at: 2_000 }],
          answers: { rent: 650, specials: 'First month free' },
        },
        {
          callId: 'c2',
          placeSlug: card.slug,
          placeTitle: card.title,
          status: 'scheduled',
          scheduledFor: 3_600_000,
          scheduleReason: 'Call in 1 min',
          transcript: [],
        },
      ],
      { userTz: 'UTC' },
    );
    const calls = msgs.filter((m) => m.log?.kind === 'call');
    expect(calls.map((c) => c.log && c.log.kind === 'call' && c.log.outcome)).toEqual([
      'answered',
      'scheduled',
    ]);
    expect(msgs.some((m) => /Rent is about \$650/i.test(m.text))).toBe(true);
    expect(msgs.some((m) => m.text.includes('Call in 1 min'))).toBe(true);
  });

  it('marks missed calls in the chatbot thread', () => {
    const msgs = messagesFromCallHistory(
      [
        {
          callId: 'miss1',
          placeSlug: card.slug,
          placeTitle: card.title,
          status: 'failed',
          error: 'missed:customer-did-not-answer',
          startedAt: 1_000,
          endedAt: 20_000,
          transcript: [],
        },
      ],
      { userTz: 'UTC' },
    );
    const call = msgs.find((m) => m.log?.kind === 'call');
    expect(call?.log && call.log.kind === 'call' && call.log.outcome).toBe('missed');
    expect(msgs.some((m) => /missed/i.test(m.text))).toBe(true);
  });

  it('summarizes rent / specials / no-SSN as plain facts — never system prompts', () => {
    const text = summarizeCallForChat({
      callId: 'cb1',
      placeSlug: card.slug,
      placeTitle: card.title,
      status: 'done',
      transcript: [
        {
          speaker: 'caller',
          text: 'You are the how.zingg Caller, a polite, brief AI phone assistant calling on behalf of Sushil, a student looking for housing. I will call you back later.',
          at: 1,
        },
        {
          speaker: 'office',
          text: 'Rent is $720 a month. We accept I-20 without SSN. Call me back in 5 minutes.',
          at: 2,
        },
      ],
      answers: {
        rent: 720,
        specials: 'If you move in before Dec 31, $200 off first month',
        noSSNOptions: 'Yes, accept applicants without a US Social Security number',
      },
    });
    expect(text).toMatch(/Here's what I got from the call/);
    expect(text).toMatch(/Rent is about \$720/);
    expect(text).toMatch(/Move-in special/);
    expect(text).toMatch(/No-SSN/);
    expect(text).toMatch(/call back in 5 minute/);
    expect(text).not.toMatch(/how\.zingg Caller/i);
    expect(text).not.toMatch(/AI phone assistant/i);
  });

  it('collects facts from office speech when structured answers are missing', () => {
    const facts = collectCallFacts({
      callId: 'x',
      placeSlug: card.slug,
      placeTitle: card.title,
      status: 'done',
      transcript: [
        { speaker: 'office', text: 'The studio is $699 per month and we take international students with an I-20.', at: 1 },
      ],
    });
    expect(facts.some((f) => /\$699/.test(f))).toBe(true);
    expect(facts.some((f) => /Social Security|I-20/i.test(f))).toBe(true);
  });
});
