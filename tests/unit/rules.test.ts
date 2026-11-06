import { describe, expect, it } from 'vitest';
import { guardedVoice, type VoiceService } from '@/lib/services/voice';
import { isAllowed, normalizePhone, NotAllowlistedError } from '@/lib/services/voice/allowlist';
import { callOpening, startsWithDisclosure, AI_DISCLOSURE } from '@/lib/rules';
import { scamCheck, shouldHide } from '@/lib/scam';

describe('call allowlist', () => {
  const list = '+16019132221, 601-555-0100';
  it('normalizes US numbers', () => {
    expect(normalizePhone('(601) 913-2221')).toBe('+16019132221');
    expect(normalizePhone('1 601 913 2221')).toBe('+16019132221');
  });
  it('allows only listed numbers', () => {
    expect(isAllowed('601 913 2221', list)).toBe(true);
    expect(isAllowed('+16015550100', list)).toBe(true);
    expect(isAllowed('+16015550142', list)).toBe(false);
    expect(isAllowed('+16019132221', '')).toBe(false);
  });
  it('never reaches the provider for a number outside the allowlist', async () => {
    let dialed = 0;
    const inner: VoiceService = {
      async placeCall() {
        dialed++;
        return { externalId: 'x', mode: 'real' };
      },
    };
    const voice = guardedVoice(inner, '+16019132221');
    const vars = {
      student_first_name: 'Asha',
      university: 'USM',
      unit: '1 bed',
      move_in_date: 'Aug 14',
      budget: '$800',
      documents: 'I-20',
      user_question: '',
      callback_email: 'a@b.c',
    };
    await expect(
      voice.placeCall({ to: '+16015550142', variables: vars, callId: 'c1' }),
    ).rejects.toBeInstanceOf(NotAllowlistedError);
    expect(dialed).toBe(0);
    await voice.placeCall({ to: '+16019132221', variables: vars, callId: 'c2' });
    expect(dialed).toBe(1);
  });
});

describe('AI disclosure', () => {
  it('is the first sentence of every call opening', () => {
    const line = callOpening('Asha', 'the University of Southern Mississippi');
    expect(line.startsWith(AI_DISCLOSURE.slice(0, -1))).toBe(true);
    expect(startsWithDisclosure(line)).toBe(true);
    expect(line).toContain('This call is recorded.');
  });
});

describe('scam check', () => {
  it('flags wire transfers and below-market rent', () => {
    const flags = scamCheck({ rent: 350, marketRent: 650, text: 'Wire the deposit today to hold it.' });
    expect(flags).toContain('wire_transfer');
    expect(flags).toContain('below_market');
    expect(shouldHide(flags)).toBe(true);
  });
  it('flags gift cards, crypto and pay-before-tour', () => {
    expect(scamCheck({ rent: 600, text: 'Pay with gift cards' })).toContain('gift_card');
    expect(scamCheck({ rent: 600, text: 'We take bitcoin only' })).toContain('crypto');
    expect(scamCheck({ rent: 600, text: 'Owner is overseas, no tours' })).toContain('pay_before_tour');
  });
  it('leaves a normal listing alone', () => {
    const flags = scamCheck({ rent: 650, marketRent: 650, text: '1 bed near campus, tours daily.' });
    expect(flags).toEqual([]);
    expect(shouldHide(flags)).toBe(false);
  });
  it('does not hide on below-market alone', () => {
    expect(shouldHide(scamCheck({ rent: 360, marketRent: 650 }))).toBe(false);
  });
});
