import type { LlmService } from './index';

/** Canned outputs keyed by prompt id. Unknown ids get a short honest fallback. */
const CANNED: Record<string, string> = {
  default: "I don't have a live model in demo mode, so here's a short example answer.",
  'office-doc-extract':
    'SUMMARY: Facts for your unit type only — rent and fees for the matching floor plan.\n- Matching unit rent listed in the packet (confirm on a call if unclear)\n- Deposit / admin fees for that unit type\n- Skip other bedroom counts that do not match your interest',
  'call-summary':
    '- Unit is available for move-in soon — confirm the exact date with the office.\n- Application and approval steps were discussed on the call.\n- Ask for written fees and deposit before signing.',
};

function answerFromPlacePrompt(prompt: string): string {
  const facts: string[] = [];
  for (const line of prompt.split('\n')) {
    const m = line.match(/^\s*-\s+(.+)/);
    if (m?.[1] && !/^\(none/i.test(m[1])) facts.push(m[1].trim());
  }
  const walk = prompt.match(/Walk to Scianna Hall[^:]*:\s*(.+)/i)?.[1]?.trim();
  const address = prompt.match(/Address:\s*(.+)/i)?.[1]?.trim();
  const q = (prompt.match(/STUDENT:\s*(.+)/i)?.[1] ?? '').toLowerCase();

  if (/\b(usm|campus|scianna|how far|distance|where)\b/.test(q) && walk) {
    return [
      `- About ${walk} to Scianna Hall on the USM campus.`,
      address && address !== 'unknown' ? `- Listed address: ${address}.` : null,
      '- CALL_OFFER: none',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const callFacts: string[] = [];
  const callSection = prompt.split('CALL NOTES')[1]?.split('OFFICE DOCUMENTS')[0] ?? '';
  for (const line of callSection.split('\n')) {
    const m = line.match(/^\s*-\s+(.+)/);
    if (m?.[1] && !/^\(no facts/i.test(m[1])) callFacts.push(m[1].trim());
  }
  if (callFacts.length > 0 && /\b(call|said|told|move.?in|process|rent|deposit)\b/i.test(q)) {
    return `${callFacts
      .slice(0, 5)
      .map((f) => `- ${f}`)
      .join('\n')}\nCALL_OFFER: none`;
  }

  const summaryMatch = prompt.match(/Summary:\s*(.+)/i);
  const summary = summaryMatch?.[1]?.trim();
  const weak =
    !summary ||
    /could not read|received .+ from the office \(focused on/i.test(summary) ||
    /\(processing\)/i.test(summary);

  if (facts.length > 0) {
    return `${facts
      .slice(0, 5)
      .map((f) => `- ${f}`)
      .join('\n')}\nCALL_OFFER: none`;
  }
  if (summary && !weak) {
    return `- ${summary}\nCALL_OFFER: none`;
  }
  if (/no office documents/i.test(prompt)) {
    return '- No office document on file yet.\nCALL_OFFER: Can you email a floor plan or fee sheet for this unit?';
  }
  return '- I still need a clearer read of the uploaded file.\nCALL_OFFER: Can you confirm studio rent, deposit, and floor plan details?';
}

export const mockLlm: LlmService = {
  async complete({ promptId, prompt }) {
    if (promptId === 'place-chat') return answerFromPlacePrompt(prompt);
    return CANNED[promptId] ?? CANNED.default!;
  },
  async structured({ promptId, schema }) {
    const parsed = schema.safeParse({});
    if (parsed.success) return parsed.data;
    throw new Error(`mockLlm has no structured output for "${promptId}"`);
  },
};
