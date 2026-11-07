'use client';

/**
 * /app: three columns.
 * - Left, "My list": places you added (swipe left), each with its latest status and progress.
 * - Middle: Scout's swipe deck.
 * - Right: the conversation for the selected place: agents report progress, you can message them.
 * UI demo on example data; nothing is sent or booked.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import {
  ArrowUp,
  CalendarClock,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOutgoing,
  Upload,
  Voicemail,
} from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { formatDual } from '@/lib/time';
import Image from 'next/image';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { BotAvatar } from '@/components/ui/BotAvatar';
import { AGENTS, AGENT_COLOR } from '@/content/agents';
import type { SwipeCard } from '@/lib/swipeDeck';
import {
  STEPS,
  formatDuration,
  replyTo,
  scriptFor,
  type AgentName,
  type ChatMessage,
} from '@/lib/conversation';

const EASE = [0.2, 0.8, 0.2, 1] as const;

type Place = {
  card: SwipeCard;
  messages: ChatMessage[];
  step: number;
  status: string;
  typing: AgentName | null;
};

const nameOf = (a: AgentName) => AGENTS.find((x) => x.id === a)!.name;

function savedMoveIn(): string | undefined {
  try {
    return (JSON.parse(localStorage.getItem('hz.trip') ?? '{}') as { moveIn?: string }).moveIn;
  } catch {
    return undefined;
  }
}

export function Workspace() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  const update = (slug: string, fn: (p: Place) => Place) =>
    setPlaces((ps) => ps.map((p) => (p.card.slug === slug ? fn(p) : p)));

  const post = (slug: string, msg: Omit<ChatMessage, 'id' | 'at'>, extra: Partial<Place> = {}) =>
    update(slug, (p) => ({
      ...p,
      ...extra,
      typing: null,
      messages: [...p.messages, { ...msg, id: `${slug}-${p.messages.length}`, at: Date.now() }],
    }));

  const add = (card: SwipeCard) => {
    if (places.some((p) => p.card.slug === card.slug)) return;
    const script = scriptFor(card, {
      userTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      moveIn: savedMoveIn(),
    });
    setPlaces((ps) => [{ card, messages: [], step: 0, status: 'Added', typing: null }, ...ps]);
    setSelected((s) => s ?? card.slug);
    for (const line of script) {
      const at = reduced ? 0 : line.after * 1000;
      if (at > 900 && !line.log) {
        timers.current.push(
          window.setTimeout(() => update(card.slug, (p) => ({ ...p, typing: line.from })), at - 900),
        );
      }
      timers.current.push(
        window.setTimeout(
          () =>
            post(
              card.slug,
              { from: line.from, text: line.text, action: line.action, log: line.log },
              { step: line.step, status: line.status },
            ),
          at,
        ),
      );
    }
  };

  const send = (slug: string, text: string) => {
    const place = places.find((p) => p.card.slug === slug);
    if (!place) return;
    post(slug, { from: 'you', text });
    timers.current.push(
      window.setTimeout(() => update(slug, (p) => ({ ...p, typing: 'concierge' })), reduced ? 0 : 400),
      window.setTimeout(
        () => post(slug, { from: 'concierge', text: replyTo(text, place.card) }),
        reduced ? 0 : 1400,
      ),
    );
  };

  const current = places.find((p) => p.card.slug === selected) ?? null;
  const realLogs = useRealCallLogs();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5 px-4 pt-20 pb-6 lg:h-dvh lg:grid-cols-[280px_minmax(0,1fr)_380px] lg:gap-6">
      <MyList places={places} selected={selected} onSelect={setSelected} />
      <div className="mx-auto w-full max-w-[480px] lg:order-none lg:overflow-y-auto">
        <SwipeDeck onAdd={add} added={places.length} />
      </div>
      <Conversation
        place={current}
        realLogs={current ? (realLogs[current.card.slug] ?? []) : []}
        onSend={send}
      />
    </div>
  );
}

/* ───────────── Left: My list ───────────── */

function MyList({
  places,
  selected,
  onSelect,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <aside aria-label="My list" className="order-2 flex min-h-0 flex-col lg:order-none">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] leading-6 font-bold">My list</h2>
        <span className="text-[13px] text-text-3">
          {places.length} {places.length === 1 ? 'place' : 'places'}
        </span>
      </div>
      {places.length === 0 ? (
        <div className="mt-3 rounded-[16px] border border-dashed border-line p-4 text-[14px] leading-5 text-text-2">
          Swipe a place left (or tap <span className="font-bold text-chalk">Add to my list</span>) and it
          lands here. Tap it to follow the team&apos;s progress.
        </div>
      ) : (
        <ul className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {places.map((p) => {
              const active = p.card.slug === selected;
              return (
                <motion.li
                  key={p.card.slug}
                  layout
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <button
                    onClick={() => onSelect(p.card.slug)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full gap-3 rounded-[16px] border p-2.5 text-left transition-colors ${active ? 'border-window bg-raised' : 'border-line bg-surface hover:bg-raised'}`}
                  >
                    <span className="block h-14 w-16 shrink-0 overflow-hidden rounded-[10px]">
                      <Image
                        src={p.card.image}
                        alt=""
                        width={128}
                        height={112}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-bold">{p.card.title}</span>
                        <span className="tabular text-[13px] font-bold text-text-2">${p.card.rent}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] leading-4 text-text-3">
                        {p.status}
                      </span>
                      <Progress step={p.step} />
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </aside>
  );
}

function Progress({ step, labels }: { step: number; labels?: boolean }) {
  return (
    <span
      className="mt-2 flex items-center gap-1"
      aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
    >
      {STEPS.map((s, i) => (
        <span key={s} className="flex flex-1 flex-col gap-1">
          <span
            className={`h-1.5 rounded-full transition-colors duration-500 ${i <= step ? 'bg-window' : 'bg-line'}`}
          />
          {labels && (
            <span className={`text-[11px] leading-3 font-bold ${i <= step ? 'text-chalk' : 'text-text-3'}`}>
              {s}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/* ───────────── Real call logs (from My Places / the calling agent) ───────────── */

type ListMineRow = {
  placeSlug: string;
  lastCall: { callId: string; status: string; startedAt?: number; endedAt?: number } | null;
  scheduledCall: { callId: string; scheduledFor: number } | null;
};

/** Calls placed or scheduled from My Places, as log rows keyed by place slug. */
function useRealCallLogs(): Record<string, ChatMessage[]> {
  const rows = useQuery(api.places.listMine) as ListMineRow[] | undefined;
  const out: Record<string, ChatMessage[]> = {};
  if (!rows) return out;
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  for (const r of rows) {
    const list: ChatMessage[] = [];
    const c = r.lastCall;
    if (c) {
      const outcome =
        c.status === 'done'
          ? 'answered'
          : c.status === 'failed'
            ? 'failed'
            : c.status === 'emailed'
              ? null
              : 'live';
      const at = c.startedAt ?? c.endedAt ?? 0;
      if (outcome) {
        list.push({
          id: `real-${c.callId}`,
          from: 'caller',
          text: 'Call',
          at,
          log: {
            kind: 'call',
            outcome,
            durationSec: c.startedAt && c.endedAt ? (c.endedAt - c.startedAt) / 1000 : undefined,
            href: `/app/calls/${c.callId}`,
            example: false,
          },
        });
      } else {
        list.push({
          id: `real-${c.callId}`,
          from: 'caller',
          text: 'Email',
          at,
          log: { kind: 'email', to: 'the office', example: false },
        });
      }
    }
    if (r.scheduledCall) {
      list.push({
        id: `real-sched-${r.scheduledCall.callId}`,
        from: 'caller',
        text: 'Scheduled call',
        at: r.scheduledCall.scheduledFor,
        log: {
          kind: 'call',
          outcome: 'scheduled',
          when: formatDual(r.scheduledCall.scheduledFor, 'America/Chicago', tz),
          href: `/app/calls/${r.scheduledCall.callId}`,
          example: false,
        },
      });
    }
    out[r.placeSlug] = list;
  }
  return out;
}

/* ───────────── Right: conversation (Messenger style) ───────────── */

const GAP_MS = 5 * 60 * 1000;

function timeLabel(at: number) {
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === today.toDateString()
    ? `Today ${time}`
    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

function Conversation({
  place,
  realLogs,
  onSend,
}: {
  place: Place | null;
  realLogs: ChatMessage[];
  onSend: (slug: string, text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [docsNote, setDocsNote] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const thread = place ? [...place.messages, ...realLogs].sort((a, b) => a.at - b.at) : [];

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [thread.length, place?.typing]);

  if (!place) {
    return (
      <aside aria-label="Conversation" className="order-3 lg:order-none">
        <div className="grid h-full min-h-[240px] place-items-center rounded-[20px] border border-line bg-surface p-6 text-center">
          <div>
            <MessageCircle size={28} className="mx-auto text-text-3" aria-hidden />
            <p className="mt-2 font-bold">Your conversations</p>
            <p className="mt-1 text-[14px] leading-5 text-text-2">
              Add a place, then tap it in My list to chat with the team and see every call.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const { card } = place;
  const lastYou = [...thread].reverse().find((m) => m.from === 'you');
  const seen = lastYou && thread.some((m) => m.at > lastYou.at && m.from === 'concierge');
  const calls = thread.filter((m) => m.log?.kind === 'call' && m.log.outcome !== 'scheduled').length;

  return (
    <aside
      aria-label={`Conversation about ${card.title}`}
      className="order-3 flex min-h-[560px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface lg:order-none lg:min-h-0"
    >
      {/* Header, like a chat header: who you're talking to and whether they're active */}
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="relative block size-11 shrink-0">
          <Image
            src={card.image}
            alt=""
            width={88}
            height={88}
            className="size-11 rounded-full object-cover"
          />
          <span
            className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface bg-window"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{card.title}</p>
          <p className="truncate text-[12px] leading-4 text-text-3">
            Team active now · {calls} {calls === 1 ? 'call' : 'calls'} · ${card.rent}/mo ·{' '}
            <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="underline">
              Source
            </a>
          </p>
        </div>
        <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] leading-4 font-bold text-text-2">
          Example
        </span>
      </header>
      <div className="border-b border-line px-4 pt-1 pb-3">
        <Progress step={place.step} labels />
      </div>

      {/* Thread */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" role="log" aria-live="polite">
        <ul className="flex flex-col">
          {thread.map((m, i) => {
            const prev = thread[i - 1];
            const next = thread[i + 1];
            const showTime = !prev || m.at - prev.at > GAP_MS;
            const isLog = !!m.log;
            const sameAsPrev = !!prev && !prev.log && !isLog && prev.from === m.from && !showTime;
            const sameAsNext =
              !!next && !next.log && !isLog && next.from === m.from && next.at - m.at <= GAP_MS;
            return (
              <li key={m.id}>
                {showTime && (
                  <p className="my-3 text-center text-[11px] leading-4 font-bold text-text-3">
                    {timeLabel(m.at)}
                  </p>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className={sameAsPrev ? 'mt-0.5' : 'mt-3'}
                >
                  {isLog ? (
                    <LogRow m={m} />
                  ) : m.from === 'you' ? (
                    <div className="flex justify-end">
                      <div
                        className={`max-w-[78%] bg-chalk px-3.5 py-2 text-[14px] leading-5 text-ink ${bubbleCorners('right', sameAsPrev, sameAsNext)}`}
                        title={timeLabel(m.at)}
                      >
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="w-7 shrink-0">
                        {!sameAsNext && (
                          <BotAvatar
                            color={AGENT_COLOR[m.from]}
                            mood="idle"
                            size={28}
                            label={nameOf(m.from)}
                          />
                        )}
                      </span>
                      <div className="max-w-[78%]">
                        {!sameAsPrev && (
                          <p
                            className="mb-0.5 ml-3 text-[11px] leading-4 font-bold"
                            style={{ color: AGENT_COLOR[m.from] }}
                          >
                            {nameOf(m.from)}
                          </p>
                        )}
                        <div
                          className={`bg-raised px-3.5 py-2 text-[14px] leading-5 ${bubbleCorners('left', sameAsPrev, sameAsNext)}`}
                          title={timeLabel(m.at)}
                        >
                          {m.text}
                          {m.action === 'add-documents' &&
                            (docsNote ? (
                              <span className="mt-2 block text-[12px] leading-4 text-text-3">
                                Document upload arrives in the next build.
                              </span>
                            ) : (
                              <button
                                onClick={() => setDocsNote(true)}
                                className="mt-2 flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-bold hover:bg-ink/40"
                              >
                                <Upload size={13} aria-hidden /> Add documents
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
                {m === lastYou && seen && (
                  <p className="mt-0.5 mr-1 text-right text-[11px] leading-4 text-text-3">Seen</p>
                )}
              </li>
            );
          })}
          {place.typing && (
            <li className="mt-3 flex items-end gap-2">
              <BotAvatar
                color={AGENT_COLOR[place.typing]}
                mood="thinking"
                size={28}
                label={`${nameOf(place.typing)} is typing`}
              />
              <span className="flex h-9 items-center rounded-[18px] rounded-bl-[6px] bg-raised px-3.5">
                <TypingDots color={AGENT_COLOR[place.typing]} />
              </span>
            </li>
          )}
        </ul>
        <div ref={end} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          onSend(card.slug, t);
          setDraft('');
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <label htmlFor="msg" className="sr-only">
          Message the team about {card.title}
        </label>
        <input
          id="msg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aa"
          className="h-10 min-w-0 flex-1 rounded-full bg-raised px-4 text-[14px] font-semibold outline-none placeholder:text-text-3 focus:ring-2 focus:ring-line"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-full text-chalk hover:bg-raised disabled:text-text-3"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>
    </aside>
  );
}

/** Messenger-style grouping: the corner next to a neighbour bubble is tight. */
function bubbleCorners(side: 'left' | 'right', joinedAbove: boolean, joinedBelow: boolean) {
  const r = 'rounded-[18px]';
  if (side === 'left')
    return `${r} ${joinedAbove ? 'rounded-tl-[6px]' : ''} ${joinedBelow ? 'rounded-bl-[6px]' : ''}`;
  return `${r} ${joinedAbove ? 'rounded-tr-[6px]' : ''} ${joinedBelow ? 'rounded-br-[6px]' : ''}`;
}

/** A call or email, shown like Messenger's call bubbles: icon, what happened, how long. */
function LogRow({ m }: { m: ChatMessage }) {
  const log = m.log!;
  let Icon = Phone;
  let title = '';
  let detail = '';
  let tone = 'bg-raised text-chalk';
  if (log.kind === 'email') {
    Icon = Mail;
    title = 'Email sent';
    detail = `To ${log.to} · ${new Date(m.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    const dur = log.durationSec !== undefined ? formatDuration(log.durationSec) : null;
    switch (log.outcome) {
      case 'answered':
        Icon = PhoneOutgoing;
        title = 'Outgoing call';
        detail = dur ? `${dur} · answered` : 'Answered';
        break;
      case 'voicemail':
        Icon = Voicemail;
        title = 'Outgoing call';
        detail = dur ? `${dur} · left a voicemail` : 'Left a voicemail';
        break;
      case 'missed':
        Icon = PhoneMissed;
        title = 'No answer';
        detail = 'Caller will try again';
        tone = 'bg-bad-bg text-bad';
        break;
      case 'failed':
        Icon = PhoneMissed;
        title = 'Call didn’t connect';
        detail = 'Caller will try again';
        tone = 'bg-bad-bg text-bad';
        break;
      case 'live':
        Icon = PhoneCall;
        title = 'On a call now';
        detail = 'Tap to listen in';
        tone = 'bg-window-dim text-good';
        break;
      case 'scheduled':
        Icon = CalendarClock;
        title = 'Call scheduled';
        detail = log.when ?? '';
        tone = 'bg-wait-bg text-wait';
        break;
    }
  }
  const body = (
    <span className="flex items-center gap-3 rounded-[18px] border border-line bg-ink/30 px-3 py-2.5">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-5 font-bold">
          {title}
          {log.example && <span className="ml-1.5 text-[11px] font-bold text-text-3">Example</span>}
        </span>
        <span className="tabular block truncate text-[12px] leading-4 text-text-3">
          {nameOf(m.from as AgentName)} · {detail}
        </span>
      </span>
      {log.kind === 'call' && log.href && <ChevronRight size={16} className="text-text-3" aria-hidden />}
    </span>
  );
  return (
    <div className="mx-auto w-full max-w-[300px]">
      {log.kind === 'call' && log.href ? (
        <Link href={log.href} className="block hover:opacity-90">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full"
          style={{ background: color }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
