import { describe, expect, it } from 'vitest';
import {
  assertCanDial,
  CallGuardrailError,
  clampCallbackMinutes,
  clampScheduleDelayMs,
  detectCallbackMinutesFromTranscript,
  earliestDialAt,
  MAX_CALLBACK_MINUTES,
  MAX_DIALS_PER_USER_PER_DAY,
  MAX_PENDING_PER_USER,
  MAX_SCHEDULE_DELAY_MS,
  MIN_CALLBACK_MINUTES,
  MIN_GAP_MS,
  MIN_SCHEDULE_DELAY_MS,
  resolveCallbackMinutes,
} from '@/lib/callGuardrails';

describe('assertCanDial', () => {
  const ok = {
    lastDialAt: null as number | null,
    dialsLastHour: 0,
    dialsToday: 0,
    pendingCount: 0,
    now: 1_000_000,
  };

  it('allows a fresh dial', () => {
    expect(() => assertCanDial(ok)).not.toThrow();
  });

  it('blocks same number within a minute', () => {
    expect(() =>
      assertCanDial({ ...ok, lastDialAt: ok.now! - 30_000 }),
    ).toThrow(CallGuardrailError);
    expect(() =>
      assertCanDial({ ...ok, lastDialAt: ok.now! - MIN_GAP_MS }),
    ).not.toThrow();
  });

  it('blocks day / pending caps (hourly limit disabled)', () => {
    expect(() =>
      assertCanDial({ ...ok, dialsLastHour: 100 }),
    ).not.toThrow();
    expect(() =>
      assertCanDial({ ...ok, dialsToday: MAX_DIALS_PER_USER_PER_DAY }),
    ).toThrow(/Daily/);
    expect(() =>
      assertCanDial({ ...ok, pendingCount: MAX_PENDING_PER_USER }),
    ).toThrow(/pending/);
  });
});

describe('schedule clamps', () => {
  it('clamps delay into 1 min … 24 h', () => {
    expect(clampScheduleDelayMs(0)).toBe(MIN_SCHEDULE_DELAY_MS);
    expect(clampScheduleDelayMs(5 * 60_000)).toBe(5 * 60_000);
    expect(clampScheduleDelayMs(MAX_SCHEDULE_DELAY_MS + 1)).toBe(MAX_SCHEDULE_DELAY_MS);
  });

  it('clamps callback minutes to 1–60', () => {
    expect(clampCallbackMinutes(0)).toBe(MIN_CALLBACK_MINUTES);
    expect(clampCallbackMinutes(5)).toBe(5);
    expect(clampCallbackMinutes(999)).toBe(MAX_CALLBACK_MINUTES);
  });

  it('computes earliest dial after last call', () => {
    const last = 1_000_000;
    expect(earliestDialAt(null, last)).toBe(last);
    expect(earliestDialAt(last, last + 10_000)).toBe(last + MIN_GAP_MS);
    expect(earliestDialAt(last, last + MIN_GAP_MS + 5_000)).toBe(last + MIN_GAP_MS + 5_000);
  });
});

describe('callback detection', () => {
  it('reads “call back in 5 minutes” from office lines', () => {
    expect(
      detectCallbackMinutesFromTranscript([
        { speaker: 'caller', text: 'Do you have a minute?' },
        { speaker: 'office', text: 'Can you call back in 5 minutes?' },
      ]),
    ).toBe(5);
  });

  it('prefers structured callbackMinutes', () => {
    expect(
      resolveCallbackMinutes({ callbackMinutes: 7 }, [
        { speaker: 'office', text: 'Call after 20 minutes' },
      ]),
    ).toBe(7);
  });

  it('falls back to transcript when structured is missing', () => {
    expect(
      resolveCallbackMinutes({}, [{ speaker: 'office', text: 'Try again after 10 mins please' }]),
    ).toBe(10);
  });
});
