/** Real calls only ever go to numbers in CALL_ALLOWLIST (comma-separated E.164). */

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

export class NotAllowlistedError extends Error {
  constructor(number: string) {
    super(`Refusing to call ${number}: not in CALL_ALLOWLIST`);
    this.name = 'NotAllowlistedError';
  }
}
