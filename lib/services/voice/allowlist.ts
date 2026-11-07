/** Real calls only ever go to numbers in CALL_ALLOWLIST (comma-separated E.164). */

/** Strict E.164: + then country code and subscriber number (8–15 digits total after +). */
const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164(raw: string): boolean {
  return E164.test(raw.trim());
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  const only = digits.replace(/\D/g, '');
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith('1')) return `+${only}`;
  return `+${only}`;
}

export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePhone);
}

export function isAllowed(number: string, allowlistRaw: string | undefined | null): boolean {
  const list = parseAllowlist(allowlistRaw);
  return list.includes(normalizePhone(number));
}

/**
 * Gate for placing a call: must be E.164 and on CALL_ALLOWLIST.
 * Returns the normalized E.164 number, or throws a typed error.
 */
export function assertCallable(
  raw: string,
  allowlistRaw: string | undefined | null,
): string {
  const trimmed = raw.trim();
  if (!isE164(trimmed)) {
    throw new InvalidPhoneError(trimmed);
  }
  if (!isAllowed(trimmed, allowlistRaw)) {
    throw new NotAllowlistedError(trimmed);
  }
  return trimmed;
}

export class NotAllowlistedError extends Error {
  constructor(number: string) {
    super(`Refusing to call ${number}: not in CALL_ALLOWLIST`);
    this.name = 'NotAllowlistedError';
  }
}

export class InvalidPhoneError extends Error {
  constructor(number: string) {
    super(`Phone must be E.164 (e.g. +16019132221), got "${number || '(empty)'}"`);
    this.name = 'InvalidPhoneError';
  }
}
