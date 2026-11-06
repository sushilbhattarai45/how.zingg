/** Landing scroll beats (BUILD_PROMPT §7.1). Ranges are fractions of the story scroller. */
export const BEATS = {
  hero: [0.0, 0.12],
  problem: [0.12, 0.22],
  team: [0.22, 0.38],
  ask: [0.38, 0.5],
  'to-work': [0.5, 0.64],
  rooms: [0.64, 0.82],
  couch: [0.82, 0.9],
  booked: [0.9, 1.0],
} as const;

export type BeatId = keyof typeof BEATS;
export const STORY_HEIGHT_VH = 700;
