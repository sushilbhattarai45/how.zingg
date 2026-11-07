import { describe, expect, it } from 'vitest';
import { guardedVoice, type VoiceService } from '@/lib/services/voice';
import { isAllowed, normalizePhone, NotAllowlistedError } from '@/lib/services/voice/allowlist';
import {
  callOpening,
  callerSystemPrompt,
  dialOpening,
  recallOpening,
  startsWithDisclosure,
  summarizePriorCall,
  AI_DISCLOSURE,
} from '@/lib/rules';
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
      async getCall() {
        return { status: 'ended', messages: [] };
      },
      async endCall() {},
    };
    const voice = guardedVoice(inner, '+16019132221');
    const base = {
      firstMessage: 'Hi',
      systemPrompt: 'test',
      callId: 'c1',
    };
    await expect(voice.placeCall({ to: '+16015550142', ...base })).rejects.toBeInstanceOf(
      NotAllowlistedError,
    );
    expect(dialed).toBe(0);
    await voice.placeCall({ to: '+16019132221', ...base, callId: 'c2' });
    expect(dialed).toBe(1);
  });
});

describe('AI disclosure', () => {
  it('is the first sentence of every call opening', () => {
    const line = callOpening('Sushil', 'the University of Southern Mississippi');
    expect(line.startsWith(AI_DISCLOSURE.slice(0, -1))).toBe(true);
    expect(startsWithDisclosure(line)).toBe(true);
    expect(line).toContain('Sushil');
    expect(line).toContain('This is a student project that is being tested and developed.');
    expect(line).toContain('This call is being recorded and will be used by the student for research.');
  });
  it('leads the dial-pad opening with Sushil, project notice, and recording notice', () => {
    const line = dialOpening();
    expect(startsWithDisclosure(line)).toBe(true);
    expect(line).toContain('Sushil');
    expect(line).toContain('This is a student project that is being tested and developed.');
    expect(line).toContain('This call is being recorded and will be used by the student for research.');
    expect(line).toContain("He's looking for housing near campus");
  });
  it('teaches Caller to acknowledge call-back requests', () => {
    expect(callerSystemPrompt(['What is rent?'])).toMatch(/call back later/i);
  });
  it('uses a distinct recall opening that still counts as disclosure', () => {
    const first = dialOpening();
    const recall = recallOpening();
    expect(recall).not.toBe(first);
    expect(recall).toMatch(/calling back|recall/i);
    expect(recall).toContain('This call is being recorded');
    expect(startsWithDisclosure(recall)).toBe(true);
  });
  it('injects prior-call memory on recall prompts and requires end-call', () => {
    const memory = summarizePriorCall({
      placeTitle: 'Oak Hollow',
      transcript: [
        { speaker: 'caller', text: 'What is rent?' },
        { speaker: 'office', text: 'Six fifty a month.' },
      ],
      answers: { rent: 650 },
    });
    expect(memory).toMatch(/Oak Hollow/);
    expect(memory).toMatch(/650/);
    const prompt = callerSystemPrompt(['Any specials?'], {
      isRecall: true,
      memory,
      placeTitle: 'Oak Hollow',
    });
    expect(prompt).toMatch(/RECALL/i);
    expect(prompt).toMatch(/PRIOR CALL MEMORY/);
    expect(prompt).toMatch(/end-call/i);
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
