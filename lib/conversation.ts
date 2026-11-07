/**
 * The per-apartment conversation after you add a place: what each agent says and when, plus the
 * progress steps. Pure, so it's testable. Honest by design: Caller schedules the call and never
 * guesses live answers (availability, today's price).
 */
import { formatDual, zonedToUtc } from '@/lib/time';
import type { SwipeCard } from '@/lib/swipeDeck';

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
  | { kind: 'email'; to: string; example: boolean };

export type ChatMessage = {
  id: string;
  from: AgentName | 'you';
  text: string;
  /** A button the student can tap (e.g. add documents). */
  action?: 'add-documents';
  /** When set, the message renders as a call/email log row. */
  log?: LogEntry;
  at: number; // epoch ms
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

function formatMoveIn(iso?: string) {
  if (!iso) return 'your move-in date';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? 'your move-in date'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function scriptFor(
  card: SwipeCard,
  { userTz, moveIn, now = new Date() }: { userTz: string; moveIn?: string; now?: Date },
): ScriptLine[] {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  const nineAm = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 9, 0, OFFICE_TZ);
  const callTime = formatDual(nineAm, OFFICE_TZ, userTz);
  const walk = card.walkMin !== undefined ? `, ${card.walkMin} min walk to Scianna Hall` : '';
  return [
    {
      after: 0,
      from: 'scout',
      text: `I added ${card.title} to your list: $${card.rent} a month${walk}.`,
      step: 0,
      status: 'Added',
    },
    {
      after: 1.6,
      from: 'concierge',
      text: "The team's on it. I'll keep you posted right here.",
      step: 0,
      status: 'Team on it',
    },
    {
      after: 3.4,
      from: 'caller',
      text: `Outgoing call to ${card.officeName}`,
      log: { kind: 'call', outcome: 'voicemail', durationSec: 52, example: true },
      step: 1,
      status: 'Left a voicemail',
    },
    {
      after: 4.6,
      from: 'caller',
      text: `Email to ${card.officeName}`,
      log: { kind: 'email', to: card.officeName, example: true },
      step: 1,
      status: 'Emailed the office',
    },
    {
      after: 6,
      from: 'caller',
      text: `No one picked up, so I left a voicemail and emailed them. I'll call again when they open and ask if the ${card.unitType} is free from ${formatMoveIn(moveIn)}.`,
      step: 1,
      status: 'Call again tomorrow',
    },
    {
      after: 6.8,
      from: 'caller',
      text: `Call scheduled with ${card.officeName}`,
      log: { kind: 'call', outcome: 'scheduled', when: callTime, example: true },
      step: 1,
      status: `Call at ${callTime.split(' (')[0]}`,
    },
    {
      after: 9,
      from: 'packet',
      text: `${card.title} will want your renter packet. I have your I-20 and visa; I still need a bank statement.`,
      action: 'add-documents',
      step: 2,
      status: 'Needs bank statement',
    },
    {
      after: 12.5,
      from: 'closer',
      text: `I asked ${card.title} about move-in specials and waiving the application fee. Waiting on the office.`,
      step: 2,
      status: 'Waiting on office',
    },
  ];
}

const LIVE = /\b(available|availability|free on|open|price|rent today|special|hold|tour|vacan)/i;

/** Concierge's reply to something you type in a conversation. */
export function replyTo(text: string, card: SwipeCard): string {
  if (LIVE.test(text)) {
    return `That needs a live answer from ${card.officeName}, so I won't guess. I added it to Caller's questions for the call.`;
  }
  if (/\b(doc|document|bank|statement|i-?20|visa|passport)\b/i.test(text)) {
    return 'Packet will handle that. You can add documents from the button above.';
  }
  return "Got it! I'll pass that to the team and post their answer here.";
}

/** "0:52", "4:07", "1:02:10" */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
