/**
 * Call fact extraction — relative imports only so Convex actions can use it.
 */
import { detectCallbackMinutesFromTranscript } from './callGuardrails';

export type CallFactRow = {
  status: string;
  transcript: { speaker: 'caller' | 'office'; text: string; at: number }[];
  answers?: {
    available?: boolean | 'unknown';
    availableDate?: string;
    rent?: number;
    deposit?: number;
    fees?: string;
    noSSNOptions?: string;
    specials?: string;
    packetEmail?: string;
    notes?: string;
  };
  error?: string;
  /** What Caller was asked to cover (optional). */
  questions?: string[];
};

export function isMissedCall(
  row: Pick<CallFactRow, 'status' | 'error' | 'transcript' | 'answers'>,
): boolean {
  if (row.status !== 'failed' && row.status !== 'done') return false;
  const err = (row.error ?? '').toLowerCase();
  if (err.startsWith('missed:') || /\bno[-_ ]?answer\b|\bbusy\b|\bmissed\b|\bdid not answer\b/.test(err)) {
    return true;
  }
  if (row.status === 'failed' && row.transcript.length === 0 && !row.answers) return true;
  return false;
}

function isJunkTranscriptLine(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return true;
  if (/^you are the how\.?zingg/i.test(t)) return true;
  if (/\bai phone assistant\b/.test(t)) return true;
  if (/\bsystem prompt\b/.test(t)) return true;
  if (/\bcalling on behalf of a student\b/.test(t) && t.length > 160) return true;
  if (/\bthis call is being recorded\b/.test(t) && !/\brent|special|ssn|available|move.?in|deposit\b/.test(t)) {
    return true;
  }
  if (/^(hi[,.]?\s+)?i'?m an ai assistant/i.test(t) && t.length > 100) return true;
  if (/\bthank you for your time\b/.test(t) && t.length < 60) return true;
  if (/^(goodbye|bye|have a (good|nice) day)[.!]?$/i.test(t)) return true;
  return false;
}

function officeLines(transcript: CallFactRow['transcript']): string[] {
  return transcript
    .filter((l) => l.speaker === 'office' && !isJunkTranscriptLine(l.text))
    .map((l) => l.text.trim());
}

function cleanFact(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim().replace(/^[•\-]\s*/, '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Split freeform notes / Gemini bullets into discrete facts. */
export function splitNotesIntoFacts(notes: string | undefined): string[] {
  if (!notes?.trim()) return [];
  const out: string[] = [];
  for (const raw of notes.split(/\n+/)) {
    const line = cleanFact(raw.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ''));
    if (line.length < 8 || isJunkTranscriptLine(line)) continue;
    if (!out.some((f) => f.toLowerCase() === line.toLowerCase())) out.push(line);
  }
  // Single paragraph with no newlines — keep as one fact if useful.
  if (out.length === 0) {
    const one = cleanFact(notes, 200);
    if (one.length >= 8 && !isJunkTranscriptLine(one)) out.push(one);
  }
  return out.slice(0, 8);
}

function pushUnique(facts: string[], fact: string) {
  const clean = cleanFact(fact);
  if (clean.length < 8) return;
  if (facts.some((f) => f.toLowerCase() === clean.toLowerCase())) return;
  facts.push(clean);
}

/** Heuristic snippets from office speech when structured fields are thin. */
function heuristicOfficeFacts(office: string): string[] {
  const found: string[] = [];
  const patterns: RegExp[] = [
    /(?:move[- ]?in|available|can (?:move|get in)|vacancy)[^.!?]{0,110}[.!?]?/gi,
    /(?:application|apply|process|approval|background|credit)[^.!?]{0,110}[.!?]?/gi,
    /(?:lease|deposit|admin fee|application fee|holding fee)[^.!?]{0,100}[.!?]?/gi,
    /(?:pet|parking|utilit(?:y|ies)|quiet hours?)[^.!?]{0,90}[.!?]?/gi,
  ];
  for (const re of patterns) {
    const matches = office.match(re);
    if (!matches) continue;
    for (const m of matches.slice(0, 2)) {
      pushUnique(found, m);
    }
  }
  // Fallback: keep short substantive office lines.
  if (found.length === 0) {
    for (const line of office
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 20 && s.length <= 160)
      .slice(0, 4)) {
      pushUnique(found, line);
    }
  }
  return found.slice(0, 5);
}

/** Pull rent / specials / no-SSN / availability / process notes from answers + office speech. */
export function collectCallFacts(row: CallFactRow): string[] {
  const facts: string[] = [];
  const a = row.answers;
  const officeParts = officeLines(row.transcript);
  const office = officeParts.join(' ');

  let rent = typeof a?.rent === 'number' ? a.rent : undefined;
  if (rent == null) {
    const m = office.match(/\$?\s*(\d{3,5})\s*(?:\/\s*mo(?:nth)?|a month|per month)\b/i);
    if (m) rent = Number(m[1]);
  }
  if (rent != null) pushUnique(facts, `Rent is about $${rent}/month.`);

  const specials = a?.specials?.trim();
  if (specials) {
    pushUnique(facts, `Move-in special: ${specials}.`);
  } else {
    const m = office.match(
      /(?:special|discount|waive|free (?:first )?month)[^.!?]{0,100}[.!?]?/i,
    );
    if (m) pushUnique(facts, `Move-in special: ${m[0]}`);
  }

  const noSsn = a?.noSSNOptions?.trim();
  if (noSsn) {
    pushUnique(facts, `No-SSN / I-20: ${noSsn}.`);
  } else if (
    /\b(no ssn|without (an? )?(ssn|social)|i-?20|international students?)\b/i.test(office)
  ) {
    pushUnique(
      facts,
      'They accept applicants without a US Social Security number (I-20 / funding letter OK).',
    );
  } else if (/\b(need|require|must have).{0,30}(ssn|social security)\b/i.test(office)) {
    pushUnique(facts, 'They require a US Social Security number.');
  }

  if (a?.availableDate) {
    pushUnique(facts, `Available / move-in: ${a.availableDate}.`);
  } else if (a?.available === true) {
    pushUnique(facts, 'A unit is available.');
  } else if (a?.available === false) {
    pushUnique(facts, 'No unit available right now.');
  } else if (/\b(available|we have (a )?unit|vacanc|move in)\b/i.test(office)) {
    const m = office.match(
      /(?:available|move[- ]?in|you can move|vacanc)[^.!?]{0,100}[.!?]?/i,
    );
    pushUnique(facts, m ? m[0] : 'They mentioned availability — confirm dates on a follow-up.');
  }

  if (typeof a?.deposit === 'number') pushUnique(facts, `Deposit is about $${a.deposit}.`);
  if (a?.fees?.trim()) pushUnique(facts, `Fees: ${a.fees}.`);

  for (const note of splitNotesIntoFacts(a?.notes)) {
    pushUnique(facts, note);
  }

  // When structured fields are thin, mine office speech for process / move-in / fees.
  if (facts.length < 2 && office.length > 20) {
    for (const h of heuristicOfficeFacts(office)) pushUnique(facts, h);
  }

  const minutes = detectCallbackMinutesFromTranscript(
    row.transcript.filter((l) => l.speaker === 'office' && !isJunkTranscriptLine(l.text)),
  );
  if (minutes != null) {
    pushUnique(facts, `They asked us to call back in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  return facts.slice(0, 8);
}

/** Format chat bubble for a finished call. */
export function formatCallNotesChat(facts: string[]): string {
  if (facts.length === 0) {
    return "Call ended. I couldn't pull clear notes yet — open the call for the transcript, or say “call and ask …” to dial again.";
  }
  return `Here's what I got from the call:\n• ${facts.join('\n• ')}`;
}
