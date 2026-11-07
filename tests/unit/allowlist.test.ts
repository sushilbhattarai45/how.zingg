import { describe, expect, it } from 'vitest';
import {
  assertCallable,
  isE164,
  InvalidPhoneError,
  NotAllowlistedError,
  normalizePhone,
} from '@/lib/services/voice/allowlist';

describe('E.164 gate', () => {
  it('accepts strict E.164', () => {
    expect(isE164('+16019132221')).toBe(true);
    expect(isE164('+447911123456')).toBe(true);
  });

  it('rejects non-E.164 input', () => {
    expect(isE164('6019132221')).toBe(false);
    expect(isE164('(601) 913-2221')).toBe(false);
    expect(isE164('+1 601 913 2221')).toBe(false);
    expect(isE164('')).toBe(false);
    expect(isE164('+0123')).toBe(false);
  });

  it('assertCallable requires E.164 and allowlist', () => {
    expect(() => assertCallable('6019132221', '+16019132221')).toThrow(InvalidPhoneError);
    expect(() => assertCallable('+16015550142', '+16019132221')).toThrow(NotAllowlistedError);
    expect(assertCallable('+16019132221', '+16019132221, +16015550100')).toBe('+16019132221');
  });

  it('normalizePhone still helps allowlist matching of formatted numbers', () => {
    expect(normalizePhone('(601) 913-2221')).toBe('+16019132221');
  });
});
