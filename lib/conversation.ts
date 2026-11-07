/**
 * The per-apartment conversation after you add a place: what each agent says and when, plus the
 * progress steps. Pure, so it's testable. Honest by design: Caller never invents live answers.
 */
import { formatDual } from '@/lib/time';
import type { SwipeCard } from '@/lib/swipeDeck';
import { collectCallFacts, formatCallNotesChat, isMissedCall } from '@/lib/callFacts';
import { parseYesNo } from '@/lib/chatFormat';

export { collectCallFacts, formatCallNotesChat, isMissedCall } from '@/lib/callFacts';

export type AgentName = 'concierge' | 'scout' | 'caller' | 'packet' | 'closer';

/** A call or email shown as a log row in the thread (like a Messenger call bubble). */
export type LogEntry =
  | {
      kind: 'call';
      outcome: 'answered' | 'voicemail' | 'missed' | 'failed' | 'live' | 'scheduled';
      /** Seconds on the call (answered / voicemail). */
      durationSec?: number;
      /** For scheduled calls: when, in both time zones. */
      when?: string;
      /** Link to the call view for real calls. */
      href?: string;
      /** Real call from the backend vs. example data. */
      example: boolean;
    }
  | {
      kind: 'email';
      to: string;
      /** Why we emailed (shown in chat). */
      reason?: string;
      example: boolean;
    }
  | {
      kind: 'document';
      fileName: string;
      summary?: string;
      /** In-app viewer or storage URL. */
      href?: string;
      example: boolean;
    };

export type ChatMessage = {
  id: string;
  from: AgentName | 'you';
  text: string;
  /** A button the student can tap (e.g. schedule a call). */
  action?: 'add-documents' | 'schedule-call' | 'pick-call-when' | 'confirm-call-offer';
  /** When set, the message renders as a call/email log row. */
  log?: LogEntry;
  at: number; // epoch ms
};

/** Chat asked Caller to dial with these questions; waiting for “when”. */
export type PendingCallAsk = {
  questions: string[];
};

/** Guide offered to call because something was unknown — waiting for yes/no. */
export type PendingCallOffer = {
  question: string;
};

export type ChatTurnResult = {
  reply: string;
  from: AgentName;
  action?: ChatMessage['action'];
  /** Set to start waiting for a when; null clears. */
  pendingAsk?: PendingCallAsk | null;
  /** Set when Guide asked “want me to call?”; null clears. */
  pendingCallOffer?: PendingCallOffer | null;
  /** Dial now (0) or after N minutes with the pending/extracted questions. */
  dial?: { delayMinutes: number; questions: string[] };
};

export const STEPS = ['Added', 'Call', 'Packet', 'Offer', 'Lease'] as const;
export type Step = (typeof STEPS)[number];

export type ScriptLine = {
  /** Seconds after the place was added. */
  after: number;
  from: AgentName;
  text: string;
  action?: ChatMessage['action'];
  log?: LogEntry;
  /** Progress step reached when this line arrives. */
  step: number;
  /** Short status for the list on the left. */
  status: string;
};

const OFFICE_TZ = 'America/Chicago';

/**
 * Only the real onboarding lines after add — no fake voicemail/email/packet demo.
 * Caller asks whether to schedule; the UI shows a Schedule button.
 */
export function scriptFor(
  card: SwipeCard,
  _opts?: { userTz?: string; moveIn?: string; now?: Date },
): ScriptLine[] {
  const walk = card.walkMin !== undefined ? `, ${card.walkMin} min walk to Scianna Hall` : '';
  return [
    {
      after: 0,
      from: 'scout',
      text: `Added to your list — ${card.title} (${card.unitType}${walk}). Rent TBD — Caller will ask on the phone.`,
      step: 0,
      status: 'Added',
    },
    {
      after: 1.4,
      from: 'concierge',
      text: "Got it on your list. The team's on it — I'll keep you posted right here.",
      step: 0,
      status: 'Team on it',
    },
    {
      after: 2.8,
      from: 'caller',
      text: 'Want to schedule a call about this place? I can ring your number now or after a short wait.',
      action: 'schedule-call',
      step: 0,
      status: 'Ready to call',
    },
  ];
}

/** Normalize a free-text ask into a question Caller can read on the phone. */
export function normalizeCallQuestion(raw: string): string {
  let q = raw.replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  q = q.replace(/^(them|the office|leasing)\s+/i, '');
  if (!q) return q;
  const ifMatch = q.match(/^(?:if|whether)\s+(.+)$/i);
  if (ifMatch) {
    const rest = ifMatch[1]!.replace(/[.?!]+$/, '');
    return `Can you tell me if ${rest}?`;
  }
  q = q.replace(/^about\s+/i, '');
  if (!/[?]$/.test(q)) q = `${q.replace(/[.!]+$/, '')}?`;
  if (!/^(what|is|are|do|does|can|will|how|when|where|who|which|would|could|may|should)/i.test(q)) {
    q = `Can you tell me about ${q.replace(/\?$/, '')}?`;
  }
  return q.charAt(0).toUpperCase() + q.slice(1);
}

/**
 * True only for explicit Caller intents, e.g.:
 * “call and ask …”, “call them about …”, “ask them …”, “ask this …”, “schedule a call”.
 * Ordinary questions stay in chat for Gemini — they must NOT dial.
 */
export function wantsExplicitCall(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\bschedule a call\b/i.test(t)) return true;
  if (/\bhave caller\b/i.test(t)) return true;
  if (/\bcall (and|&) ask\b/i.test(t)) return true;
  if (/\b(call|ring|dial)\s+(them|the office|leasing)\b/i.test(t)) return true;
  if (/\b(call|ring|dial).{0,48}\bask\b/i.test(t)) return true;
  if (/\bask (them|the office|leasing|this)\b/i.test(t)) return true;
  return false;
}

/**
 * Pull “call and ask …” / “ask them …” questions from a chat line.
 * Returns [] when they want a call with default questions; null when not a call request.
 */
export function extractCallQuestions(text: string): string[] | null {
  const t = text.trim();
  if (!wantsExplicitCall(t)) return null;

  const ask =
    t.match(/\bask(?:\s+(?:them|the office|leasing|this))?\s+(.+)$/i) ||
    t.match(/\b(?:call|ring|dial).{0,48}?\bask(?:\s+(?:them|the office|leasing|this))?\s+(.+)$/i);
  if (ask?.[1]) {
    const parts = ask[1]
      .split(/\band also\b|\balso\b|;|\n/i)
      .map((p) => normalizeCallQuestion(p))
      .filter(Boolean);
    return parts.length ? parts : [];
  }

  const about = t.match(/\b(?:call|ring|dial).{0,40}\babout\s+(.+)$/i);
  if (about?.[1]) return [normalizeCallQuestion(about[1])];

  // “call them” / “schedule a call” with no specific question → defaults.
  return [];
}

/** Parse “now / 1 min / 5 min / …” from a when-reply. */
export function parseCallWhen(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/^(now|asap|immediately)\b/.test(t) || /\b(right now|call now)\b/.test(t)) return 0;
  if (/\bin\s+an?\s+hour\b/.test(t) || /\b1\s*h(our)?\b/.test(t) || /\b60\s*m/.test(t)) return 60;
  const m = t.match(/(?:in\s+)?(\d+)\s*(minutes?|mins?|min|hours?|hrs?|h)\b/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (/^h/.test(m[2]!)) return Math.min(60, Math.round(n * 60));
    return Math.min(60, Math.max(1, Math.round(n)));
  }
  if (/^(1|5|15|60)$/.test(t)) return Number(t) === 60 ? 60 : Number(t);
  return null;
}

function whenPrompt(questions: string[]): { text: string; action: ChatMessage['action'] } {
  const qLine =
    questions.length > 0
      ? `I'll have Caller ask: ${questions.map((q) => `“${q}”`).join(' · ')}`
      : `I'll have Caller run our usual questions (rent, specials, no-SSN).`;
  return {
    text: `${qLine}\n\nWhen should I call your number? Reply with now, 1 min, 5 min, 15 min, or 1 hour — or tap a button.`,
    action: 'pick-call-when',
  };
}

/**
 * Guide's reply to something you type. May ask when to call, or trigger a dial
 * once you answer with a time.
 */
export function handleChatTurn(
  text: string,
  card: SwipeCard,
  pending: PendingCallAsk | null,
  pendingCallOffer: PendingCallOffer | null = null,
): ChatTurnResult {
  // After Guide asked “want me to call?” — yes → schedule when; no → stay in chat.
  if (pendingCallOffer) {
    const yn = parseYesNo(text);
    if (yn === 'yes') {
      const questions = [normalizeCallQuestion(pendingCallOffer.question)];
      const prompt = whenPrompt(questions);
      return {
        from: 'concierge',
        reply: prompt.text,
        action: prompt.action,
        pendingAsk: { questions },
        pendingCallOffer: null,
      };
    }
    if (yn === 'no') {
      return {
        from: 'concierge',
        reply: '• Got it — I won’t call.\n• Ask me anything else about this place, or say “call and ask …” later if you change your mind.',
        pendingCallOffer: null,
        pendingAsk: null,
      };
    }
    // Explicit call phrasing still works while the offer is open.
    const freshDuringOffer = extractCallQuestions(text);
    if (freshDuringOffer) {
      const prompt = whenPrompt(freshDuringOffer);
      return {
        from: 'concierge',
        reply: prompt.text,
        action: prompt.action,
        pendingAsk: { questions: freshDuringOffer },
        pendingCallOffer: null,
      };
    }
    return {
      from: 'concierge',
      reply: `• Still waiting on a yes/no — should I call and ask: “${pendingCallOffer.question}”?`,
      action: 'confirm-call-offer',
      pendingCallOffer,
    };
  }

  if (pending) {
    const delay = parseCallWhen(text);
    if (delay != null) {
      const whenLabel =
        delay === 0 ? 'now' : delay === 60 ? 'in 1 hour' : `in ${delay} min`;
      const qBit =
        pending.questions.length > 0
          ? ` Asking: ${pending.questions.map((q) => `“${q}”`).join(' · ')}`
          : '';
      return {
        from: 'caller',
        reply: `Got it — calling ${whenLabel}.${qBit}`,
        pendingAsk: null,
        pendingCallOffer: null,
        dial: { delayMinutes: delay, questions: pending.questions },
      };
    }
    // Maybe they changed the question while we wait for when.
    const fresh = extractCallQuestions(text);
    if (fresh) {
      const prompt = whenPrompt(fresh);
      return {
        from: 'concierge',
        reply: prompt.text,
        action: prompt.action,
        pendingAsk: { questions: fresh },
      };
    }
    return {
      from: 'concierge',
      reply:
        'Still need a time — reply with now, 1 min, 5 min, 15 min, or 1 hour (or tap a button below).',
      action: 'pick-call-when',
      pendingAsk: pending,
    };
  }

  const callQs = extractCallQuestions(text);
  if (callQs) {
    const prompt = whenPrompt(callQs);
    return {
      from: 'concierge',
      reply: prompt.text,
      action: prompt.action,
      pendingAsk: { questions: callQs },
    };
  }

  // Everything else → Gemini in the Workspace (docs + place context).
  void card;
  return {
    from: 'concierge',
    reply: '__gemini__',
  };
}

/** True when handleChatTurn deferred the reply to the Gemini chat action. */
export function needsGeminiChat(turn: ChatTurnResult): boolean {
  return turn.reply === '__gemini__';
}

/** @deprecated Prefer handleChatTurn — kept for older call sites / tests. */
export function replyTo(text: string, card: SwipeCard): string {
  return handleChatTurn(text, card, null).reply;
}

/** "0:52", "4:07", "1:02:10" */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** One finished / live / scheduled call from Convex, for the workspace thread. */
export type CallHistoryRow = {
  callId: string;
  placeSlug: string;
  placeTitle: string;
  status: string;
  startedAt?: number;
  endedAt?: number;
  scheduledFor?: number;
  scheduleReason?: string;
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
  isExample?: boolean;
  error?: string;
};

function callOutcome(
  row: Pick<CallHistoryRow, 'status' | 'error' | 'transcript' | 'answers'>,
): LogEntry & { kind: 'call' } {
  if (row.status === 'scheduled') {
    return { kind: 'call', outcome: 'scheduled', example: false };
  }
  if (row.status === 'ringing' || row.status === 'live') {
    return { kind: 'call', outcome: 'live', example: false };
  }
  if (isMissedCall(row)) {
    return { kind: 'call', outcome: 'missed', example: false };
  }
  if (row.status === 'failed') {
    return { kind: 'call', outcome: 'failed', example: false };
  }
  if (row.status === 'emailed') {
    return { kind: 'call', outcome: 'missed', example: false };
  }
  return { kind: 'call', outcome: 'answered', example: false };
}

/**
 * Concierge post-call note for the chatbot: plain facts (rent, what they accept, specials).
 * Never dumps system prompts or raw Caller lines.
 */
export function summarizeCallForChat(row: CallHistoryRow): string {
  if (isMissedCall(row)) {
    return "Missed call — nobody picked up. I can try again or schedule a callback whenever you want.";
  }
  if (row.status === 'failed') {
    return "We couldn't connect. Tap the phone icon to retry, or schedule for later.";
  }

  return formatCallNotesChat(collectCallFacts(row));
}

/**
 * Turn every call for a place into messenger log bubbles + agent summary notes,
 * sorted chronologically so multiple calls on the same place read as a chat history.
 */
export function messagesFromCallHistory(
  rows: CallHistoryRow[],
  { userTz }: { userTz: string },
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const row of rows) {
    const at =
      row.status === 'scheduled'
        ? (row.scheduledFor ?? row.startedAt ?? Date.now())
        : (row.startedAt ?? row.scheduledFor ?? row.endedAt ?? Date.now());

    if (row.status === 'emailed') {
      out.push({
        id: `hist-email-${row.callId}`,
        from: 'caller',
        text: 'Email',
        at,
        log: { kind: 'email', to: 'the office', example: Boolean(row.isExample) },
      });
      continue;
    }

    const log = callOutcome(row);
    log.example = Boolean(row.isExample);
    log.href = `/app/calls/${row.callId}`;
    if (row.startedAt && row.endedAt && row.endedAt > row.startedAt) {
      log.durationSec = (row.endedAt - row.startedAt) / 1000;
    }
    if (log.outcome === 'scheduled' && row.scheduledFor) {
      log.when = formatDual(row.scheduledFor, OFFICE_TZ, userTz);
    }

    out.push({
      id: `hist-call-${row.callId}`,
      from: 'caller',
      text:
        log.outcome === 'missed'
          ? 'Missed call'
          : row.status === 'scheduled'
            ? 'Scheduled call'
            : 'Call',
      at,
      log,
    });

    let note: string | null = null;
    let noteAt = at + 1;
    if (row.status === 'scheduled') {
      note = row.scheduleReason
        ? `I've got a call locked for later — ${row.scheduleReason}.`
        : `Call scheduled${row.scheduledFor ? ` for ${formatDual(row.scheduledFor, OFFICE_TZ, userTz)}` : ''}.`;
    } else if (row.status === 'ringing' || row.status === 'live') {
      note = `On the line about ${row.placeTitle} now — I'll drop rent / specials / no-SSN here when we're done.`;
    } else if (row.status === 'done' || row.status === 'failed') {
      note = summarizeCallForChat(row);
      noteAt = (row.endedAt ?? at) + 1;
    }
    if (note) {
      out.push({
        id: `hist-note-${row.callId}`,
        from: row.status === 'done' || row.status === 'failed' ? 'concierge' : 'caller',
        text: note,
        at: noteAt,
      });
    }
  }
  return out;
}

export type OfficeDocHistoryRow = {
  documentId: string;
  placeSlug: string;
  placeTitle: string;
  fileName: string;
  summary?: string;
  status: string;
  createdAt: number;
  url?: string | null;
  contentType?: string;
};

export type PlaceEmailHistoryRow = {
  emailId: string;
  placeSlug: string;
  placeTitle: string;
  kind: string;
  toLabel: string;
  reason: string;
  createdAt: number;
};

/** Messenger log bubbles for office-uploaded documents. */
export function messagesFromDocuments(rows: OfficeDocHistoryRow[]): ChatMessage[] {
  return rows.map((row) => ({
    id: `hist-doc-${row.documentId}`,
    from: 'packet' as const,
    text: row.summary
      ? `Document received: ${row.fileName} · ${row.summary}`
      : `Document received: ${row.fileName}`,
    at: row.createdAt,
    log: {
      kind: 'document' as const,
      fileName: row.fileName,
      summary: row.summary,
      href: `/app/docs/${row.documentId}`,
      example: false,
    },
  }));
}

/** Messenger log bubbles for outbound emails (office doc request, etc.). */
export function messagesFromPlaceEmails(rows: PlaceEmailHistoryRow[]): ChatMessage[] {
  return rows
    .filter((row) => row.kind === 'realty_doc_request')
    .map((row) => ({
      id: `hist-email-${row.emailId}`,
      from: 'packet' as const,
      text: `Emailed the office — ${row.reason}`,
      at: row.createdAt,
      log: {
        kind: 'email' as const,
        to: row.toLabel,
        reason: row.reason,
        example: false,
      },
    }));
}
