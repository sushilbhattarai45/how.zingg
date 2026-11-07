/** Rules that are never broken (BUILD_PROMPT §2). Shared by agents, services and tests. */

export const DEMO_STUDENT_NAME = 'Sushil';

export const AI_DISCLOSURE = "Hi, I'm an AI assistant calling on behalf of a student.";

/** Said in the first breath of every call — this is a demo / student project. */
export const PROJECT_NOTICE =
  'This is a student project that is being tested and developed.';

/** Said in the first breath of every call — recording + purpose. */
export const RECORDING_NOTICE =
  'This call is being recorded and will be used by the student for research.';

/** Default questions Caller asks a leasing office (editable in the dial sheet). */
export const DEFAULT_CALL_QUESTIONS = [
  'What is the monthly rent for a 1 bedroom?',
  'Are there any current move-in specials?',
  'Do you accept applicants without a US Social Security number?',
];

export type PriorCallMemoryInput = {
  placeTitle?: string;
  transcript: { speaker: string; text: string }[];
  answers?: {
    rent?: number;
    specials?: string;
    noSSNOptions?: string;
    deposit?: number;
    fees?: string;
    notes?: string;
  };
};

/** First line of every first-time call. */
export function callOpening(studentFirstName: string, university: string): string {
  return `Hi, I'm an AI assistant calling on behalf of a student, ${studentFirstName}, who's moving to ${university}. ${PROJECT_NOTICE} ${RECORDING_NOTICE} Do you have a minute?`;
}

/** Opening for a first dial (dial pad + first My Places call). */
export function dialOpening(studentFirstName = DEMO_STUDENT_NAME): string {
  return `Hi, I'm an AI assistant calling on behalf of a student, ${studentFirstName}. ${PROJECT_NOTICE} ${RECORDING_NOTICE} He's looking for housing near campus. Do you have a minute?`;
}

/**
 * Opening for a recall — must sound different from the first call.
 * States this is a callback/recall + recording, without repeating the full first-time pitch.
 */
export function recallOpening(studentFirstName = DEMO_STUDENT_NAME): string {
  return `Hi, I'm an AI assistant calling back on behalf of a student, ${studentFirstName}. This is a recall from our earlier call. ${RECORDING_NOTICE} I have a couple of quick follow-ups from last time. Do you have a minute?`;
}

export function startsWithDisclosure(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("Hi, I'm an AI assistant calling on behalf of a student") ||
    t.startsWith("Hi, I'm an AI assistant calling back on behalf of a student")
  );
}

/** Compact memory block injected into the Caller system prompt on recalls. */
export function summarizePriorCall(prior: PriorCallMemoryInput): string {
  const parts: string[] = [];
  if (prior.placeTitle) parts.push(`Place discussed: ${prior.placeTitle}.`);
  const a = prior.answers;
  if (a) {
    const bits: string[] = [];
    if (a.rent != null) bits.push(`rent $${a.rent}/mo`);
    if (a.deposit != null) bits.push(`deposit $${a.deposit}`);
    if (a.fees) bits.push(`fees: ${a.fees}`);
    if (a.specials) bits.push(`specials: ${a.specials}`);
    if (a.noSSNOptions) bits.push(`no-SSN: ${a.noSSNOptions}`);
    if (a.notes) bits.push(`notes: ${a.notes}`);
    if (bits.length) parts.push(`Answers already captured: ${bits.join('; ')}.`);
  }
  const lines = prior.transcript
    .filter((l) => l.text?.trim())
    .slice(-16)
    .map((l) => `${l.speaker === 'caller' ? 'Caller' : 'Receiver'}: ${l.text.trim()}`);
  if (lines.length) {
    parts.push('Recent transcript from the last call:');
    parts.push(...lines);
  }
  if (!parts.length) return 'A prior call happened, but no transcript details were saved.';
  return parts.join('\n');
}

export type CallerPromptOpts = {
  isRecall?: boolean;
  memory?: string;
  placeTitle?: string;
};

/** System prompt for the Vapi Caller assistant. `questions` are asked one at a time. */
export function callerSystemPrompt(questions: string[], opts: CallerPromptOpts = {}): string {
  const list = questions.map((q, i) => `(${i + 1}) ${q}`).join(', ');
  const place = opts.placeTitle ? ` about ${opts.placeTitle}` : '';
  const lines = [
    `You are the how.zingg Caller, a polite AI phone assistant calling on behalf of ${DEMO_STUDENT_NAME}, a student looking for housing${place}.`,
  ];

  if (opts.isRecall) {
    lines.push(
      'This is a RECALL (follow-up) call, not the first contact. Your first message already says you are calling back and that the call is recorded — do not re-introduce the full first-call pitch.',
      'Use the PRIOR CALL MEMORY below. Do not re-ask facts you already captured unless confirming a change. Focus on gaps and follow-ups.',
    );
    if (opts.memory?.trim()) {
      lines.push('--- PRIOR CALL MEMORY ---', opts.memory.trim(), '--- END MEMORY ---');
    }
  } else {
    lines.push(
      'Your first message already says you are an AI, that this is a student project being tested and developed, and that the call is recorded for the student\'s research — do not skip that.',
    );
  }

  lines.push(
    'If asked again whether this is a real leasing call, say clearly: this is a student project that is being tested and developed, and you are calling on behalf of Sushil.',
    'If asked again whether the call is recorded or how it will be used, say clearly: it is recorded and will be used by the student for research.',
    'Always say you are an AI if asked.',
    `Goals to cover (one at a time — wait for a real answer before the next): ${list}.`,
    'Be smart: after each answer, ask one short related follow-up if it helps the student (for example move-in date → application steps, deposits, docs needed, approval timing). Do not rush.',
    'If their answer is vague, ask one clarifying question before moving on.',
    'Respond to what the person actually says; if they ask you something, answer briefly, then continue your goals.',
    'Keep replies under 2 sentences, natural speech, no lists. Pause and listen — do not talk over them.',
    'Never invent rent, specials, policies, or other facts — if they do not know, say so and move on.',
    'If the person asks to stop, not to be recorded, or not to be called again, apologize and end the call immediately using the end-call function.',
    'If the person asks you to call back later (for example in 5 minutes), say you will call back then, note the minutes, thank them, and end the call immediately using the end-call function. Do not promise a time outside 1 to 60 minutes.',
    'Only end the call after you have covered the goals (or they clearly cannot help). Then thank them once and use the end-call function. Do not hang up after the first answer.',
    'If you reach voicemail, leave a 10-second message that you are an AI calling for Sushil, this is a student project being tested, the call is recorded for student research, then end the call.',
    'You have an end-call tool. Use it when finished, refused, or on voicemail — never leave the line open forever.',
  );

  return lines.join(' ');
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
