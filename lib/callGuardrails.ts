/**
 * Hard limits for Caller dials / schedules — abuse and spam prevention.
 * Pure helpers; Convex actions enforce using live dial stats.
 */

export const MIN_GAP_MS = 60_000;
export const MAX_PENDING_PER_USER = 5;
/** Hourly per-number cap disabled for now (kept for dialStats / future re-enable). */
export const MAX_DIALS_PER_NUMBER_PER_HOUR = Number.POSITIVE_INFINITY;
export const MAX_DIALS_PER_USER_PER_DAY = 20;
export const MIN_SCHEDULE_DELAY_MS = 60_000;
export const MAX_SCHEDULE_DELAY_MS = 24 * 60 * 60_000;
export const MIN_CALLBACK_MINUTES = 1;
export const MAX_CALLBACK_MINUTES = 60;

export class CallGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallGuardrailError';
  }
}

export type DialStats = {
  lastDialAt: number | null;
  dialsLastHour: number;
  dialsToday: number;
  pendingCount: number;
  now?: number;
};

/** Throw if an immediate dial would violate rate limits. */
export function assertCanDial(stats: DialStats): void {
  const now = stats.now ?? Date.now();
  if (stats.pendingCount >= MAX_PENDING_PER_USER) {
    throw new CallGuardrailError(
      `Too many pending scheduled calls (max ${MAX_PENDING_PER_USER}). Cancel one first.`,
    );
  }
  if (stats.dialsToday >= MAX_DIALS_PER_USER_PER_DAY) {
    throw new CallGuardrailError(
      `Daily call limit reached (max ${MAX_DIALS_PER_USER_PER_DAY} per day). Try again tomorrow.`,
    );
  }
  // Hourly per-number limit intentionally disabled.
  if (stats.lastDialAt != null && now - stats.lastDialAt < MIN_GAP_MS) {
    const waitSec = Math.ceil((MIN_GAP_MS - (now - stats.lastDialAt)) / 1000);
    throw new CallGuardrailError(
      `Cannot call the same number within a minute. Wait ${waitSec}s and try again.`,
    );
  }
}

/**
 * Earliest timestamp we may dial this number given the last dial.
 * Used to bump a scheduledFor when the chosen delay would violate the 60s gap.
 */
export function earliestDialAt(lastDialAt: number | null, now = Date.now()): number {
  if (lastDialAt == null) return now;
  return Math.max(now, lastDialAt + MIN_GAP_MS);
}

/** Clamp a user/receiver delay into the allowed schedule window. */
export function clampScheduleDelayMs(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_SCHEDULE_DELAY_MS;
  return Math.min(MAX_SCHEDULE_DELAY_MS, Math.max(MIN_SCHEDULE_DELAY_MS, Math.round(ms)));
}

/** Clamp receiver-requested callback minutes (1–60). */
export function clampCallbackMinutes(n: number): number {
  if (!Number.isFinite(n)) return MIN_CALLBACK_MINUTES;
  return Math.min(MAX_CALLBACK_MINUTES, Math.max(MIN_CALLBACK_MINUTES, Math.round(n)));
}

/**
 * Parse office transcript lines for “call back in/after N minutes”.
 * Returns minutes or null.
 */
export function detectCallbackMinutesFromTranscript(
  lines: { speaker: string; text: string }[],
): number | null {
  const re =
    /(?:call(?:\s+me)?\s+back|call(?:\s+me)?|try(?:\s+again)?|ring(?:\s+me)?)\s+(?:back\s+)?(?:in|after)\s+(\d+)\s*(?:minutes?|mins?|min)\b/i;
  const reAlt = /(?:in|after)\s+(\d+)\s*(?:minutes?|mins?|min)\b.*\b(?:call|ring|callback)\b/i;
  for (const line of lines) {
    if (line.speaker !== 'office') continue;
    const text = line.text.trim();
    const m = text.match(re) ?? text.match(reAlt);
    if (m?.[1]) return clampCallbackMinutes(Number(m[1]));
  }
  return null;
}

/** Resolve structured callbackMinutes from Vapi analysis, else transcript fallback. */
export function resolveCallbackMinutes(
  structured: Record<string, unknown> | undefined,
  lines: { speaker: string; text: string }[],
): number | null {
  const raw = structured?.callbackMinutes;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return clampCallbackMinutes(raw);
  }
  if (typeof raw === 'string') {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) return clampCallbackMinutes(n);
  }
  return detectCallbackMinutesFromTranscript(lines);
}
