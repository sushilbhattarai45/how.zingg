/**
 * Normalize Guide/Packet chat replies: bullet-first, optional call-offer footer.
 */

export type FormattedGuideReply = {
  text: string;
  /** If set, Guide should ask “want me to call?” with this office question. */
  callOffer: string | null;
};

const CALL_OFFER_RE = /(?:^|\n)\s*(?:---\s*)?CALL_OFFER:\s*(.+?)\s*$/im;

/** Pull CALL_OFFER marker and turn the body into short bullets. */
export function formatGuideReply(raw: string): FormattedGuideReply {
  let body = (raw ?? '').trim();
  let callOffer: string | null = null;

  const m = body.match(CALL_OFFER_RE);
  if (m) {
    const offered = m[1]!.trim();
    body = body.replace(CALL_OFFER_RE, '').trim();
    if (offered && !/^(none|no|n\/a|-)$/i.test(offered)) {
      callOffer = offered.replace(/^["']|["']$/g, '').slice(0, 200);
    }
  }

  // Drop legacy filler if the model still emits it.
  body = body
    .replace(/Based on what we have so far,[\s\S]*?I'll dial\.?/gi, '')
    .replace(/Got it! I'll pass that to the team\.[\s\S]*$/gi, '')
    .trim();

  const bullets = toBullets(body);
  let text = bullets.join('\n');

  if (callOffer) {
    text = `${text}\n\nI don't have a solid answer on that yet.\n• Want me to call the office and ask: “${callOffer}”? (yes / no)`.trim();
  }

  if (!text) {
    text = callOffer
      ? `• I don't have that in our notes yet.\n• Want me to call the office and ask: “${callOffer}”? (yes / no)`
      : '• I need a bit more to go on — ask about rent, the floor plan, fees, or campus distance.';
  }

  return { text: text.slice(0, 1400), callOffer };
}

function toBullets(body: string): string[] {
  const lines = body
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  // Already short bullet-like lines
  if (lines.length >= 2 && lines.every((l) => l.length < 160)) {
    return lines.slice(0, 8).map((l) => `• ${l}`);
  }

  // Split long paragraphs into sentences → bullets
  const sentences = body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  if (sentences.length === 0) return body ? [`• ${body.slice(0, 180)}`] : [];

  return sentences.slice(0, 6).map((s) => `• ${s.replace(/^[•-]\s*/, '')}`);
}

export function parseYesNo(text: string): 'yes' | 'no' | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/^(y|yes|yeah|yep|sure|ok|okay|please|do it|call|go ahead)\b/.test(t)) return 'yes';
  if (/^(n|no|nope|nah|don't|do not|not now|cancel)\b/.test(t)) return 'no';
  if (/\b(yes|yeah|sure).{0,20}\b(call|ask)\b/.test(t)) return 'yes';
  if (/\bno\b.{0,12}\b(call|thanks|need)\b/.test(t)) return 'no';
  return null;
}
