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
import { useAction, useMutation, useQuery } from 'convex/react';
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
  Trash2,
  Upload,
  Voicemail,
} from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Image from 'next/image';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { CallOptionsSheet } from '@/components/calls/CallOptionsSheet';
import { StudentPacketPanel } from '@/components/packet/StudentPacketPanel';
import { BotAvatar } from '@/components/ui/BotAvatar';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENTS, AGENT_COLOR } from '@/content/agents';
import { placeBySlug, type SwipeCard } from '@/lib/swipeDeck';
import { getGuestKey } from '@/lib/guestKey';
import { readTripProfile } from '@/lib/studentPacket';
import {
  clearThreadCache,
  mergeMessages,
  readThreadCache,
  writeThreadCache,
} from '@/lib/threadCache';
import {
  STEPS,
  formatDuration,
  handleChatTurn,
  messagesFromCallHistory,
  messagesFromDocuments,
  messagesFromPlaceEmails,
  needsGeminiChat,
  scriptFor,
  type AgentName,
  type CallHistoryRow,
  type ChatMessage,
  type OfficeDocHistoryRow,
  type PlaceEmailHistoryRow,
  type PendingCallAsk,
  type PendingCallOffer,
} from '@/lib/conversation';
import { useRouter } from 'next/navigation';

type AgentToast = {
  id: string;
  from: AgentName;
  text: string;
};

const EASE = [0.2, 0.8, 0.2, 1] as const;

const WHEN_CHIPS = [
  { label: 'Now', minutes: 0 },
  { label: '1 min', minutes: 1 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
] as const;

type Place = {
  card: SwipeCard;
  interestId: Id<'placeInterests'> | null;
  messages: ChatMessage[];
  step: number;
  status: string;
  typing: AgentName | null;
  pendingAsk: PendingCallAsk | null;
  pendingCallOffer: PendingCallOffer | null;
};

const nameOf = (a: AgentName) => AGENTS.find((x) => x.id === a)!.name;

function cardFromInterest(row: {
  placeSlug: string;
  placeTitle: string;
  unitType: string;
  rent: number;
  addressQuery: string;
}): SwipeCard {
  const seed = placeBySlug(row.placeSlug);
  return {
    slug: row.placeSlug,
    title: row.placeTitle,
    address: seed?.address ?? row.addressQuery,
    unitType: row.unitType,
    rent: row.rent,
    deposit: seed?.deposit,
    walkMin: seed?.walkMin,
    noSSN: seed?.noSSN ?? 'Ask on the call',
    officeName: seed?.officeName ?? 'Leasing office',
    availableFrom: seed?.availableFrom ?? new Date().toISOString().slice(0, 10),
    sourceUrl: seed?.sourceUrl ?? '#',
    pitch: seed?.pitch ?? row.placeTitle,
    image: seed?.image ?? '/places/oak-hollow.jpg',
    hue: 160,
  };
}

function persistableMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => !m.log)
    .map((m) => ({
      id: m.id,
      from: m.from,
      text: m.text,
      action: m.action,
      at: m.at,
    }));
}

function toChatMessages(
  rows: { id: string; from: string; text: string; action?: string; at: number }[],
): ChatMessage[] {
  return rows.map((m) => ({
    id: m.id,
    from: m.from as AgentName | 'you',
    text: m.text,
    action: m.action as ChatMessage['action'],
    at: m.at,
  }));
}

export function Workspace() {
  const [guestKey, setGuestKey] = useState<string | undefined>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [callSheet, setCallSheet] = useState<{
    interestId: Id<'placeInterests'>;
    placeTitle: string;
  } | null>(null);
  const [toasts, setToasts] = useState<AgentToast[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const removedSlugs = useRef<Set<string>>(new Set());
  const hydratedThreads = useRef<Set<string>>(new Set());
  const reduced = useReducedMotion() ?? false;
  const removeFromList = useAction(api.places.removeFromList);
  const upsertThread = useMutation(api.places.upsertThread);

  useEffect(() => setGuestKey(getGuestKey()), []);
  const syncTrip = useMutation(api.packet.syncTripProfile);
  useEffect(() => {
    if (!guestKey) return;
    const trip = readTripProfile();
    if (!trip.name && !trip.moveIn && !trip.country && !trip.whatsapp) return;
    void syncTrip({
      guestKey,
      name: trip.name,
      whatsapp: trip.whatsapp,
      homeCountry: trip.country,
      arrivalDate: trip.moveIn,
      hasSSN: trip.hasSSN ?? null,
      budgetMax: trip.budgetMax ?? null,
    }).catch(() => {});
  }, [guestKey, syncTrip]);

  const saved = useQuery(api.places.listMine, guestKey ? { guestKey } : 'skip') as
    | {
        _id: Id<'placeInterests'>;
        placeSlug: string;
        placeTitle: string;
        unitType: string;
        rent: number;
        addressQuery: string;
        lastCall: { status: string; error?: string } | null;
        scheduledCall: { scheduledFor: number } | null;
      }[]
    | undefined;
  const threads = useQuery(api.places.listThreads, guestKey ? { guestKey } : 'skip') as
    | Record<
        string,
        {
          messages: { id: string; from: string; text: string; action?: string; at: number }[];
          step: number;
          status: string;
          pendingAsk?: { questions: string[] } | null;
          updatedAt: number;
        }
      >
    | undefined;

  // Hydrate My list + full chat from Convex + local cache whenever you open /app.
  useEffect(() => {
    if (!saved) return;
    const stillSaved = new Set(saved.map((r) => r.placeSlug));
    for (const slug of [...removedSlugs.current]) {
      if (!stillSaved.has(slug)) removedSlugs.current.delete(slug);
    }
    setPlaces((prev) => {
      const prevBySlug = new Map(prev.map((p) => [p.card.slug, p]));
      const next: Place[] = [];
      for (const row of saved) {
        if (removedSlugs.current.has(row.placeSlug)) continue;
        const existing = prevBySlug.get(row.placeSlug);
        const server = threads?.[row.placeSlug];
        const cached = readThreadCache(row.placeSlug);
        const serverMsgs = server ? toChatMessages(server.messages) : [];
        const cachedMsgs = cached?.messages ?? [];
        const localMsgs = existing?.messages ?? [];
        const messages = mergeMessages(serverMsgs, cachedMsgs, localMsgs);

        const missed =
          row.lastCall?.status === 'failed' &&
          (!row.lastCall.error || /missed|no.?answer|busy/i.test(row.lastCall.error));
        const fallbackStatus = row.scheduledCall
          ? 'Call scheduled'
          : missed
            ? 'Missed call'
            : row.lastCall?.status === 'done'
              ? 'Call logged'
              : row.lastCall?.status === 'live' || row.lastCall?.status === 'ringing'
                ? 'On a call'
                : row.lastCall?.status === 'failed'
                  ? 'Call failed'
                  : row.lastCall
                    ? 'Call history'
                    : 'On your list';

        const place: Place = {
          card: existing?.card ?? cardFromInterest(row),
          interestId: row._id,
          messages,
          step: Math.max(
            existing?.step ?? 0,
            server?.step ?? 0,
            cached?.step ?? 0,
            row.lastCall ? 1 : 0,
          ),
          status: existing?.status?.length
            ? existing.status
            : (server?.status ?? cached?.status ?? fallbackStatus),
          typing: existing?.typing ?? null,
          pendingAsk:
            existing?.pendingAsk ?? server?.pendingAsk ?? cached?.pendingAsk ?? null,
          pendingCallOffer: existing?.pendingCallOffer ?? null,
        };
        next.push(place);
        hydratedThreads.current.add(row.placeSlug);
        // Keep local cache aligned with the merged thread.
        writeThreadCache(row.placeSlug, {
          messages: persistableMessages(messages) as ChatMessage[],
          step: place.step,
          status: place.status,
          pendingAsk: place.pendingAsk,
        });
      }
      // Keep any in-session places not yet in saved (rare race while savePlace finishes).
      for (const p of prev) {
        if (!stillSaved.has(p.card.slug) && !removedSlugs.current.has(p.card.slug)) {
          if (!next.some((n) => n.card.slug === p.card.slug)) next.push(p);
        }
      }
      return next;
    });
    setSelected((s) => {
      if (s && saved.some((r) => r.placeSlug === s)) return s;
      return saved[0]?.placeSlug ?? null;
    });
  }, [saved, threads]);

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  const persistPlace = (slug: string, place: Place) => {
    const msgs = persistableMessages(place.messages);
    writeThreadCache(slug, {
      messages: msgs as ChatMessage[],
      step: place.step,
      status: place.status,
      pendingAsk: place.pendingAsk,
    });
    const key = getGuestKey();
    if (!key) return;
    void upsertThread({
      guestKey: key,
      placeSlug: slug,
      messages: msgs,
      step: place.step,
      status: place.status,
      pendingAsk: place.pendingAsk,
    });
  };

  const update = (slug: string, fn: (p: Place) => Place) =>
    setPlaces((ps) =>
      ps.map((p) => {
        if (p.card.slug !== slug) return p;
        const next = fn(p);
        const shouldSave =
          next.messages !== p.messages ||
          next.step !== p.step ||
          next.status !== p.status ||
          next.pendingAsk !== p.pendingAsk;
        if (shouldSave) persistPlace(slug, next);
        return next;
      }),
    );

  const post = (slug: string, msg: Omit<ChatMessage, 'id' | 'at'>, extra: Partial<Place> = {}) =>
    update(slug, (p) => {
      const nextMsg: ChatMessage = {
        ...msg,
        id: `${slug}:msg:${msg.from}:${Date.now()}`,
        at: Date.now(),
      };
      // Skip if we just posted the exact same bubble (double-submit / strict remount).
      const last = p.messages[p.messages.length - 1];
      if (
        last &&
        last.from === nextMsg.from &&
        last.text.trim() === nextMsg.text.trim() &&
        nextMsg.at - last.at < 2000
      ) {
        // `extra` last so callers can keep a typing indicator (e.g. waiting on Gemini).
        return { ...p, typing: null, ...extra };
      }
      return {
        ...p,
        typing: null,
        ...extra,
        messages: mergeMessages(p.messages, [nextMsg]),
      };
    });

  const pushToast = (from: AgentName, text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t) => [...t.slice(-3), { id, from, text }]);
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200));
  };

  const add = (card: SwipeCard, interestId: string | null) => {
    const id = (interestId as Id<'placeInterests'> | null) ?? null;
    if (places.some((p) => p.card.slug === card.slug)) {
      pushToast('scout', `${card.title} is already on your list.`);
      pushToast('caller', 'Want to schedule a call? Tap Schedule in the chat or the phone icon.');
      setSelected(card.slug);
      if (id) update(card.slug, (p) => ({ ...p, interestId: id }));
      return;
    }
    const script = scriptFor(card);
    hydratedThreads.current.add(card.slug);
    setPlaces((ps) => [
      {
        card,
        interestId: id,
        messages: [],
        step: 0,
        status: 'Added',
        typing: null,
        pendingAsk: null,
        pendingCallOffer: null,
      },
      ...ps,
    ]);
    setSelected(card.slug);

    pushToast('scout', `Added ${card.title} to your list.`);
    timers.current.push(
      window.setTimeout(
        () => pushToast('concierge', "Got it on your list — I'll keep you posted here."),
        reduced ? 0 : 900,
      ),
      window.setTimeout(
        () => pushToast('caller', 'Want to schedule a call?'),
        reduced ? 0 : 1800,
      ),
    );

    for (const line of script) {
      const at = reduced ? 0 : line.after * 1000;
      if (at > 900) {
        timers.current.push(
          window.setTimeout(() => update(card.slug, (p) => ({ ...p, typing: line.from })), at - 900),
        );
      }
      timers.current.push(
        window.setTimeout(() => {
          update(card.slug, (p) => ({
            ...p,
            typing: null,
            step: line.step,
            status: line.status,
            interestId: id ?? p.interestId,
            messages: mergeMessages(p.messages, [
              {
                id: `${card.slug}:intro:${line.from}:${line.after}`,
                from: line.from,
                text: line.text,
                action: line.action,
                at: Date.now(),
              },
            ]),
          }));
        }, at),
      );
    }
  };

  const remove = async (slug: string) => {
    if (removing) return;
    setRemoving(slug);
    removedSlugs.current.add(slug);
    try {
      await removeFromList({ placeSlug: slug, guestKey: getGuestKey() });
      clearThreadCache(slug);
      hydratedThreads.current.delete(slug);
      setPlaces((ps) => ps.filter((p) => p.card.slug !== slug));
      setSelected((s) => (s === slug ? null : s));
      pushToast('scout', 'Removed from your list.');
    } catch {
      removedSlugs.current.delete(slug);
      pushToast('concierge', "Couldn't remove that place — try again.");
    } finally {
      setRemoving(null);
    }
  };

  const openCallSheetFor = (place: Place) => {
    if (!place.interestId) {
      pushToast('caller', 'Still saving this place — try again in a second.');
      return;
    }
    setCallSheet({ interestId: place.interestId, placeTitle: place.card.title });
  };

  const router = useRouter();
  const callSaved = useAction(api.places.callSaved);
  const scheduleCall = useAction(api.places.scheduleCall);
  const geminiReply = useAction(api.chat.replyAboutPlace);

  const runDial = async (
    place: Place,
    delayMinutes: number,
    questions: string[],
  ): Promise<string | null> => {
    if (!place.interestId) {
      pushToast('caller', 'Still saving this place — try again in a second.');
      return 'Still saving this place — try again in a second.';
    }
    try {
      if (delayMinutes <= 0) {
        const { callId } = await callSaved({
          interestId: place.interestId,
          guestKey: getGuestKey(),
          extraQuestions: questions,
        });
        router.push(`/app/calls/${callId}`);
        return null;
      }
      await scheduleCall({
        interestId: place.interestId,
        delayMinutes,
        reason:
          questions.length > 0
            ? `Chat: call in ${delayMinutes} min — ${questions[0]}`
            : `Chat: call in ${delayMinutes} min`,
        guestKey: getGuestKey(),
        extraQuestions: questions,
      });
      pushToast('caller', `Call scheduled in ${delayMinutes} min.`);
      return null;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').replace(/^Uncaught Error:\s*/i, '')
          : 'Could not start or schedule the call';
      pushToast('caller', msg);
      return msg;
    }
  };

  const applyChatTurn = (slug: string, text: string, asYou: boolean) => {
    const place = places.find((p) => p.card.slug === slug);
    if (!place) return;
    // Don't stack Gemini requests while one is in flight.
    if (place.typing && asYou) return;

    const turn = handleChatTurn(text, place.card, place.pendingAsk, place.pendingCallOffer);

    if (needsGeminiChat(turn)) {
      // Show typing immediately with the user bubble (post used to wipe typing).
      if (asYou) post(slug, { from: 'you', text }, { typing: 'concierge', status: 'Guide is thinking…' });
      else update(slug, (p) => ({ ...p, typing: 'concierge', status: 'Guide is thinking…' }));

      void (async () => {
        try {
          const recent = place.messages
            .filter((m) => !m.log)
            .slice(-8)
            .map((m) => ({ from: String(m.from), text: m.text }));
          const res = await geminiReply({
            guestKey: getGuestKey(),
            placeSlug: place.card.slug,
            placeTitle: place.card.title,
            unitType: place.card.unitType,
            officeName: place.card.officeName,
            address: place.card.address,
            walkMin: place.card.walkMin,
            pitch: place.card.pitch,
            noSSN: place.card.noSSN,
            availableFrom: place.card.availableFrom,
            message: text,
            recent,
          });
          update(slug, (p) => ({
            ...p,
            typing: null,
            status: 'On your list',
            pendingCallOffer: res.callOffer ? { question: res.callOffer } : null,
            messages: mergeMessages(p.messages, [
              {
                id: `${slug}:msg:${res.from}:${Date.now()}`,
                from: res.from,
                text: res.reply,
                action: res.callOffer ? 'confirm-call-offer' : undefined,
                at: Date.now(),
              },
            ]),
          }));
        } catch {
          update(slug, (p) => ({
            ...p,
            typing: null,
            status: 'On your list',
            messages: mergeMessages(p.messages, [
              {
                id: `${slug}:msg:concierge:${Date.now()}`,
                from: 'concierge',
                text: '• I couldn’t answer that just now.\n• Try again, or say “call and ask …” to dial the office.',
                at: Date.now(),
              },
            ]),
          }));
        }
      })();
      return;
    }

    if (asYou) post(slug, { from: 'you', text });

    timers.current.push(
      window.setTimeout(() => update(slug, (p) => ({ ...p, typing: turn.from })), reduced ? 0 : 400),
      window.setTimeout(() => {
        update(slug, (p) => ({
          ...p,
          typing: null,
          pendingAsk: turn.pendingAsk === undefined ? p.pendingAsk : turn.pendingAsk,
          pendingCallOffer:
            turn.pendingCallOffer === undefined ? p.pendingCallOffer : turn.pendingCallOffer,
          status: turn.dial
            ? turn.dial.delayMinutes <= 0
              ? 'Calling…'
              : 'Call scheduled'
            : p.status,
          messages: mergeMessages(p.messages, [
            {
              id: `${slug}:msg:${turn.from}:${Date.now()}`,
              from: turn.from,
              text: turn.reply,
              action: turn.action,
              at: Date.now(),
            },
          ]),
        }));
        if (turn.dial) {
          void runDial(place, turn.dial.delayMinutes, turn.dial.questions);
        }
      }, reduced ? 0 : 1400),
    );
  };

  const send = (slug: string, text: string) => applyChatTurn(slug, text, true);

  const pickWhen = (slug: string, minutes: number) => {
    const label =
      minutes <= 0 ? 'now' : minutes === 60 ? 'in 1 hour' : `in ${minutes} min`;
    applyChatTurn(slug, label, true);
  };

  const confirmCallOffer = (slug: string, yes: boolean) => {
    applyChatTurn(slug, yes ? 'yes' : 'no', true);
  };

  const current = places.find((p) => p.card.slug === selected) ?? null;
  const realLogs = useRealCallLogs(guestKey);
  const syncCall = useAction(api.calls.syncCall);

  // Keep in-progress / just-ended calls syncing while you're on /app so summaries land live.
  useEffect(() => {
    const now = Date.now();
    const liveIds = new Set<string>();
    for (const msgs of Object.values(realLogs)) {
      for (const m of msgs) {
        if (m.log?.kind !== 'call' || !m.log.href) continue;
        const id = m.log.href.replace('/app/calls/', '');
        if (m.log.outcome === 'live') liveIds.add(id);
        // Sync recently finished calls briefly so rent/specials analysis can land without refresh.
        if (
          (m.log.outcome === 'answered' || m.log.outcome === 'missed' || m.log.outcome === 'failed') &&
          now - m.at < 90_000
        ) {
          liveIds.add(id);
        }
      }
    }
    if (liveIds.size === 0) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      for (const id of liveIds) {
        void syncCall({ callId: id as Id<'calls'> }).catch(() => {});
      }
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [realLogs, syncCall]);

  // Live toasts when a call ends / summary appears — no page refresh needed.
  const eventSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const [slug, msgs] of Object.entries(realLogs)) {
      for (const m of msgs) {
        if (eventSeen.current.has(m.id)) continue;
        if (m.log?.kind === 'call' && m.log.outcome === 'missed') {
          eventSeen.current.add(m.id);
          const place = places.find((p) => p.card.slug === slug);
          pushToast('caller', `Missed call${place ? ` about ${place.card.title}` : ''} — nobody picked up.`);
          update(slug, (p) => ({ ...p, status: 'Missed call', step: Math.max(p.step, 1) }));
        } else if (m.id.startsWith('hist-note-') && m.from === 'concierge' && m.text.startsWith("Here's what I got")) {
          eventSeen.current.add(m.id);
          pushToast('concierge', 'Call summary is in the chat.');
          update(slug, (p) => {
            if (p.messages.some((x) => x.id === m.id)) {
              return { ...p, status: 'Call summarized', step: Math.max(p.step, 1) };
            }
            return {
              ...p,
              status: 'Call summarized',
              step: Math.max(p.step, 1),
              messages: [...p.messages, { ...m }],
            };
          });
        } else if (m.id.startsWith('hist-note-') && m.from === 'concierge') {
          eventSeen.current.add(m.id);
          update(slug, (p) => {
            if (p.messages.some((x) => x.id === m.id)) return p;
            return {
              ...p,
              status: p.status.startsWith('Missed') ? p.status : 'Call logged',
              step: Math.max(p.step, 1),
              messages: [...p.messages, { ...m }],
            };
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to new log rows only
  }, [realLogs, guestKey]);

  return (
    <div className="relative mx-auto grid max-w-[1400px] gap-5 px-4 pt-20 pb-6 lg:h-dvh lg:grid-cols-[280px_minmax(0,1fr)_380px] lg:gap-6">
      <MyList
        places={places}
        selected={selected}
        removing={removing}
        onSelect={setSelected}
        onRemove={(slug) => void remove(slug)}
      />
      <div className="mx-auto w-full max-w-[480px] lg:order-none lg:overflow-y-auto">
        <SwipeDeck
          onAdd={add}
          added={places.length}
          addedSlugs={places.map((p) => p.card.slug)}
        />
      </div>
      <Conversation
        place={current}
        realLogs={current ? (realLogs[current.card.slug] ?? []) : []}
        onSend={send}
        onPickWhen={current ? (mins) => pickWhen(current.card.slug, mins) : undefined}
        onConfirmCallOffer={
          current ? (yes) => confirmCallOffer(current.card.slug, yes) : undefined
        }
        onRemove={current ? () => void remove(current.card.slug) : undefined}
        onScheduleCall={current ? () => openCallSheetFor(current) : undefined}
        removing={removing === current?.card.slug}
      />
      <CallOptionsSheet
        open={!!callSheet}
        onClose={() => setCallSheet(null)}
        interestId={callSheet?.interestId ?? null}
        placeTitle={callSheet?.placeTitle ?? ''}
      />
      <AgentToastStack toasts={toasts} />
    </div>
  );
}

function AgentToastStack({ toasts }: { toasts: AgentToast[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(100%-2rem,340px)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="pointer-events-auto flex gap-3 rounded-[16px] border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-float)]"
          >
            <span className="mt-1.5 shrink-0">
              <AgentDot color={AGENT_COLOR[t.from]} size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-4 font-bold" style={{ color: AGENT_COLOR[t.from] }}>
                {nameOf(t.from)}
              </p>
              <p className="mt-0.5 text-[14px] leading-5 font-semibold text-chalk">{t.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ───────────── Left: My list ───────────── */

function MyList({
  places,
  selected,
  removing,
  onSelect,
  onRemove,
}: {
  places: Place[];
  selected: string | null;
  removing: string | null;
  onSelect: (slug: string) => void;
  onRemove: (slug: string) => void;
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
              const busy = removing === p.card.slug;
              return (
                <motion.li
                  key={p.card.slug}
                  layout
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16, height: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`relative rounded-[16px] border transition-colors ${active ? 'border-window bg-raised' : 'border-line bg-surface hover:bg-raised'}`}
                >
                  <button
                    onClick={() => onSelect(p.card.slug)}
                    aria-current={active ? 'true' : undefined}
                    className="flex w-full gap-3 p-2.5 pr-10 text-left"
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
                        <span className="truncate text-[12px] font-bold text-text-3">{p.card.unitType}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] leading-4 text-text-3">
                        {p.status}
                      </span>
                      <Progress step={p.step} />
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${p.card.title} from my list`}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(p.card.slug);
                    }}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-text-3 hover:bg-bad-bg hover:text-bad disabled:opacity-50"
                  >
                    <Trash2 size={14} aria-hidden />
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

/* ───────────── Real call logs (full history per place) ───────────── */

/** Every call + office email + document for each place, as messenger log rows. */
function useRealCallLogs(guestKey: string | undefined): Record<string, ChatMessage[]> {
  const history = useQuery(api.places.listCallHistory, guestKey ? { guestKey } : 'skip') as
    | Record<string, CallHistoryRow[]>
    | undefined;
  const docs = useQuery(api.documents.listMineByPlace, guestKey ? { guestKey } : 'skip') as
    | Record<string, OfficeDocHistoryRow[]>
    | undefined;
  const emails = useQuery(api.documents.listEmailsByPlace, guestKey ? { guestKey } : 'skip') as
    | Record<string, PlaceEmailHistoryRow[]>
    | undefined;
  const out: Record<string, ChatMessage[]> = {};
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  const slugs = new Set([
    ...Object.keys(history ?? {}),
    ...Object.keys(docs ?? {}),
    ...Object.keys(emails ?? {}),
  ]);
  for (const slug of slugs) {
    const callMsgs = history?.[slug] ? messagesFromCallHistory(history[slug]!, { userTz: tz }) : [];
    const emailMsgs = emails?.[slug] ? messagesFromPlaceEmails(emails[slug]!) : [];
    const docMsgs = docs?.[slug] ? messagesFromDocuments(docs[slug]!) : [];
    out[slug] = mergeMessages(callMsgs, emailMsgs, docMsgs).sort(
      (a, b) => a.at - b.at || a.id.localeCompare(b.id),
    );
  }
  return out;
}

/* ───────────── Right: conversation (Messenger style) ───────────── */

const GAP_MS = 5 * 60 * 1000;

/** Day + date + time so multiple calls on the same place are easy to tell apart. */
function timeLabel(at: number) {
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  if (d.toDateString() === today.toDateString()) return `Today · ${weekday} · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${weekday} · ${time}`;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${weekday} · ${date} · ${time}`;
}

function Conversation({
  place,
  realLogs,
  onSend,
  onPickWhen,
  onConfirmCallOffer,
  onRemove,
  onScheduleCall,
  removing,
}: {
  place: Place | null;
  realLogs: ChatMessage[];
  onSend: (slug: string, text: string) => void;
  onPickWhen?: (minutes: number) => void;
  onConfirmCallOffer?: (yes: boolean) => void;
  onRemove?: () => void;
  onScheduleCall?: () => void;
  removing?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [packetOpen, setPacketOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const thread = place ? mergeMessages(place.messages, realLogs) : [];

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
  const calls = thread.filter(
    (m) => m.log?.kind === 'call' && m.log.outcome !== 'scheduled' && !m.log.example,
  ).length;

  return (
    <>
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
            Team active now · {calls} {calls === 1 ? 'call' : 'calls'} · {card.unitType} · rent via call ·{' '}
            <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="underline">
              Source
            </a>
          </p>
        </div>
        <button
          type="button"
          aria-label="Manage application documents"
          onClick={() => setPacketOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-raised text-chalk hover:bg-window-dim"
          title="Your packet — upload & share with office"
        >
          <Upload size={15} aria-hidden />
        </button>
        {onScheduleCall && (
          <button
            type="button"
            aria-label={`Call about ${card.title}`}
            onClick={onScheduleCall}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-raised text-chalk hover:bg-window-dim"
            title="Caller — call or schedule"
          >
            <span className="relative">
              <Phone size={15} aria-hidden />
              <span
                className="absolute -right-1 -bottom-1 size-2 rounded-full"
                style={{ background: AGENT_COLOR.caller }}
                aria-hidden
              />
            </span>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${card.title} from my list`}
            disabled={removing}
            onClick={onRemove}
            className="grid size-9 shrink-0 place-items-center rounded-full text-text-3 hover:bg-bad-bg hover:text-bad disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
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
                          className={`whitespace-pre-line bg-raised px-3.5 py-2 text-[14px] leading-5 ${bubbleCorners('left', sameAsPrev, sameAsNext)}`}
                          title={timeLabel(m.at)}
                        >
                          {m.text}
                          {m.action === 'schedule-call' && onScheduleCall && (
                            <button
                              type="button"
                              onClick={onScheduleCall}
                              className="mt-2 flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-bold hover:bg-ink/40"
                            >
                              <CalendarClock size={13} aria-hidden /> Schedule a call
                            </button>
                          )}
                          {m.action === 'pick-call-when' && onPickWhen && (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {WHEN_CHIPS.map((c) => (
                                <button
                                  key={c.minutes}
                                  type="button"
                                  onClick={() => onPickWhen(c.minutes)}
                                  className="flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-bold hover:bg-ink/40"
                                >
                                  {c.minutes === 0 ? <Phone size={12} aria-hidden /> : <CalendarClock size={12} aria-hidden />}
                                  {c.label}
                                </button>
                              ))}
                            </span>
                          )}
                          {m.action === 'confirm-call-offer' && onConfirmCallOffer && (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onConfirmCallOffer(true)}
                                className="flex min-h-9 items-center gap-1 rounded-full border border-window/50 bg-window-dim px-3 text-[12px] font-bold text-good hover:bg-window/20"
                              >
                                <Phone size={12} aria-hidden /> Yes, call them
                              </button>
                              <button
                                type="button"
                                onClick={() => onConfirmCallOffer(false)}
                                className="flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-bold hover:bg-ink/40"
                              >
                                No thanks
                              </button>
                            </span>
                          )}
                          {m.action === 'add-documents' && (
                              <button
                                type="button"
                                onClick={() => setPacketOpen(true)}
                                className="mt-2 flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-bold hover:bg-ink/40"
                              >
                                <Upload size={13} aria-hidden /> Add documents
                              </button>
                            )}
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
            <li className="mt-3 flex items-end gap-2" aria-live="polite">
              <BotAvatar
                color={AGENT_COLOR[place.typing]}
                mood="thinking"
                size={28}
                label={`${nameOf(place.typing)} is typing`}
              />
              <span className="flex min-h-9 flex-col justify-center gap-0.5 rounded-[18px] rounded-bl-[6px] bg-raised px-3.5 py-2">
                <span className="text-[11px] leading-3 font-bold text-text-3">
                  {nameOf(place.typing)} is thinking…
                </span>
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
          if (!t || place.typing) return;
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
          placeholder={place.typing ? `${nameOf(place.typing)} is thinking…` : 'Aa'}
          disabled={Boolean(place.typing)}
          className="h-10 min-w-0 flex-1 rounded-full bg-raised px-4 text-[14px] font-semibold outline-none placeholder:text-text-3 focus:ring-2 focus:ring-line disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || Boolean(place.typing)}
          className="grid size-10 shrink-0 place-items-center rounded-full text-chalk hover:bg-raised disabled:text-text-3"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>
    </aside>
    <StudentPacketPanel
      open={packetOpen}
      onClose={() => setPacketOpen(false)}
      placeSlug={card.slug}
      placeTitle={card.title}
    />
    </>
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
  const whenShort = new Date(m.at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  let Icon = Phone;
  let title = '';
  let detail = '';
  let tone = 'bg-raised text-chalk';
  if (log.kind === 'email') {
    Icon = Mail;
    title = 'Email sent to office';
    detail = log.reason
      ? `${log.reason} · ${whenShort}`
      : `To ${log.to} · ${whenShort}`;
  } else if (log.kind === 'document') {
    Icon = Upload;
    title = 'Document received';
    detail = log.summary
      ? `${log.fileName} · ${log.summary}`
      : `${log.fileName} · tap to view · ${whenShort}`;
  } else {
    const dur = log.durationSec !== undefined ? formatDuration(log.durationSec) : null;
    switch (log.outcome) {
      case 'answered':
        Icon = PhoneOutgoing;
        title = 'Outgoing call';
        detail = dur ? `${dur} · answered · ${whenShort}` : `Answered · ${whenShort}`;
        break;
      case 'voicemail':
        Icon = Voicemail;
        title = 'Outgoing call';
        detail = dur ? `${dur} · left a voicemail · ${whenShort}` : `Left a voicemail · ${whenShort}`;
        break;
      case 'missed':
        Icon = PhoneMissed;
        title = 'Missed call';
        detail = `No answer · ${whenShort}`;
        tone = 'bg-bad-bg text-bad';
        break;
      case 'failed':
        Icon = PhoneMissed;
        title = 'Call didn’t connect';
        detail = `Caller will try again · ${whenShort}`;
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
        detail = log.when ?? whenShort;
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
          {'example' in log && log.example && (
            <span className="ml-1.5 text-[11px] font-bold text-text-3">Example</span>
          )}
        </span>
        <span className="tabular block text-[12px] leading-4 text-text-3">
          {nameOf(m.from as AgentName)} · {detail}
        </span>
      </span>
      {(log.kind === 'call' || log.kind === 'document') && 'href' in log && log.href && (
        <ChevronRight size={16} className="shrink-0 text-text-3" aria-hidden />
      )}
    </span>
  );
  const href =
    (log.kind === 'call' || log.kind === 'document') && 'href' in log ? log.href : undefined;
  return (
    <div className="mx-auto w-full max-w-[320px]">
      {href ? (
        <Link href={href} className="block hover:opacity-90">
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
