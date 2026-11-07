import { describe, expect, it } from 'vitest';

/** Mirrors convex/documents.getTokenInfo expiry rules for unit coverage. */
function validateTokenRow(
  row: { expiresAt: number } | null,
  now = Date.now(),
): { ok: true } | { ok: false; reason: 'invalid' | 'expired' } {
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.expiresAt < now) return { ok: false, reason: 'expired' };
  return { ok: true };
}

describe('doc upload token validation', () => {
  it('rejects missing tokens', () => {
    expect(validateTokenRow(null)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects expired tokens', () => {
    expect(validateTokenRow({ expiresAt: Date.now() - 1_000 })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('accepts fresh tokens', () => {
    expect(validateTokenRow({ expiresAt: Date.now() + 60_000 })).toEqual({ ok: true });
  });
});
