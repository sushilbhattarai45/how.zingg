/**
 * Post-call Gemini summary helpers (shared by Convex Node action + tests).
 */

export function parseCallSummaryBullets(text: string): string[] {
  const bullets: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s*(.+)/);
    if (m?.[1]) {
      const t = m[1].replace(/\s+/g, ' ').trim().slice(0, 160);
      if (t.length >= 8) bullets.push(t);
      continue;
    }
  }
  if (bullets.length === 0) {
    const one = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (one.length >= 12) bullets.push(one);
  }
  return bullets.slice(0, 8);
}

export function callSummarySystem(placeTitle: string, questions: string[]): string {
  const asked =
    questions.length > 0
      ? questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : '1. Rent, specials, no-SSN, availability / move-in process';
  return [
    'You summarize a phone call between how.zingg Caller and a leasing office.',
    `Place: ${placeTitle}.`,
    'Write 3–7 short factual bullets the student needs.',
    'Each line MUST start with "- ".',
    'Cover answers to the questions asked, plus useful related facts (fees, process, documents, dates).',
    'Never invent numbers or policies not clearly said on the call.',
    'Skip greetings, AI disclosure, and goodbyes.',
    'Questions that were asked:',
    asked,
  ].join('\n');
}

export function callSummaryPrompt(
  transcript: { speaker: string; text: string }[],
): string {
  const lines = transcript
    .filter((l) => l.text?.trim())
    .slice(-40)
    .map((l) => `${l.speaker === 'caller' ? 'Caller' : 'Office'}: ${l.text.trim()}`);
  return `TRANSCRIPT:\n${lines.join('\n') || '(empty)'}\n\nWrite the bullet notes now.`;
}
