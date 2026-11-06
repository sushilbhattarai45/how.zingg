/**
 * The demo clock. In DEMO_MODE "now" is fixed so the golden path is deterministic:
 * a weekday at 9:02 AM America/Chicago in summer (CDT), so
 *  - Oak Hollow is open (Caller can call right away),
 *  - Pine Row is closed and its call schedules for 9:00 AM CT = 7:45 PM in Kathmandu.
 *
 * Default: Wednesday 2027-07-14 09:02 CDT = 14:02 UTC. Override with DEMO_NOW (ISO string).
 * The clock advances in real time from the moment the process first reads it, so timers still tick.
 */

export const DEFAULT_DEMO_NOW = '2027-07-14T14:02:00Z';

function env(name: string): string | undefined {
  // process.env exists in Node, Next (server) and Convex runtimes.
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export function isDemoMode(): boolean {
  return env('DEMO_MODE') === '1' || env('NEXT_PUBLIC_DEMO_MODE') === '1';
}

const bootReal = Date.now();

/** Current time in UTC ms, respecting the demo clock. */
export function now(): number {
  if (!isDemoMode()) return Date.now();
  const anchor = Date.parse(env('DEMO_NOW') || DEFAULT_DEMO_NOW);
  return anchor + (Date.now() - bootReal);
}

/** Demo clock pinned exactly to its anchor (no drift) — for seeds and tests. */
export function demoAnchor(): number {
  return Date.parse(env('DEMO_NOW') || DEFAULT_DEMO_NOW);
}
