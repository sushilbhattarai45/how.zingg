/**
 * Stable per-browser guest id so unsigned workspace data is not shared across people
 * on the shared demo user.
 */
const KEY = 'hz.guestKey';

export function getGuestKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, next);
    return next;
  } catch {
    return `g-session-${Date.now()}`;
  }
}
