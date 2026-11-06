/** Rules that are never broken (BUILD_PROMPT §2). Shared by agents, services and tests. */

export const AI_DISCLOSURE = "Hi, I'm an AI assistant calling on behalf of a student.";

export const RECORDING_NOTICE = 'This call is recorded.';

/** First line of every call: disclosure first, then who and where. */
export function callOpening(studentFirstName: string, university: string): string {
  return `Hi, I'm an AI assistant calling on behalf of a student, ${studentFirstName}, who's moving to ${university}. ${RECORDING_NOTICE} Do you have a minute?`;
}

export function startsWithDisclosure(line: string): boolean {
  return line.trim().startsWith("Hi, I'm an AI assistant calling on behalf of a student");
}

/** Words we never use to describe places or areas (fair housing, §2.4 / §9.4). */
export const BANNED_AREA_WORDS = [
  'safe',
  'unsafe',
  'sketchy',
  'dangerous',
  'nice area',
  'good neighborhood',
  'bad neighborhood',
  'bad area',
  'rough',
  'ghetto',
];

/** Lifestyle fields roommate matching may use. Anything else is ignored. */
export const ROOMMATE_MATCH_FIELDS = ['budgetMin', 'budgetMax', 'moveIn', 'tags'] as const;
