/**
 * The landing "show": a short animation that plays by itself (no scrolling).
 * Progress 0..1 over SHOW_SECONDS.
 * - out:  the team hangs out on the block (campus, closed building, leasing office)
 * - walk: they walk into the apartment; the roof lifts off
 * - work: everyone at their station, working
 * - bye:  they turn and wave goodbye
 */
export const SHOW = {
  out: [0.0, 0.16],
  walk: [0.16, 0.52],
  work: [0.52, 0.82],
  bye: [0.82, 1.0],
} as const;

export type ShowPart = keyof typeof SHOW;

export const SHOW_SECONDS = 22;

export function showPartAt(p: number): ShowPart {
  if (p < SHOW.walk[0]) return 'out';
  if (p < SHOW.work[0]) return 'walk';
  if (p < SHOW.bye[0]) return 'work';
  return 'bye';
}
