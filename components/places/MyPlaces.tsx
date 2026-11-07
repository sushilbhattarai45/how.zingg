'use client';

/**
 * Saved swipe places + last call/recording + schedule (DEMO_CALL_TO only).
 */
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Heart,
  MapPin,
  MessageSquareText,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENT_COLOR } from '@/content/agents';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { placeBySlug } from '@/lib/swipeDeck';
import { getGuestKey } from '@/lib/guestKey';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  ringing: 'Ringing',
  live: 'In progress',
  done: 'Ended',
  failed: 'Failed',
  emailed: 'Emailed',
};

const SCHEDULE_PRESETS = [
  { label: '1 min', minutes: 1 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
] as const;

type LastCall = {
  callId: Id<'calls'>;
  status: string;
  startedAt?: number;
  endedAt?: number;
  transcript: { speaker: 'caller' | 'office'; text: string; at: number }[];
  answers?: {
    rent?: number;
    specials?: string;
    noSSNOptions?: string;
  };
  mode?: 'mock' | 'vapi';
  isExample?: boolean;
  recordingUrl: string | null;
  hasPlayableRecording: boolean;
  recordingStatus?: 'pending' | 'ready' | 'unavailable';
};

type ScheduledCall = {
  callId: Id<'calls'>;
  scheduledFor: number;
  scheduleSource?: 'user' | 'receiver' | 'immediate';
  scheduleReason?: string;
};

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function cleanError(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  return err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').replace(/^Uncaught Error:\s*/i, '');
}

export function MyPlaces() {
  const router = useRouter();
  const [guestKey, setGuestKey] = useState<string | undefined>();
  useEffect(() => setGuestKey(getGuestKey()), []);
  const interests = useQuery(api.places.listMine, guestKey ? { guestKey } : 'skip');
  const callSaved = useAction(api.places.callSaved);
  const scheduleCall = useAction(api.places.scheduleCall);
  const cancelSchedule = useAction(api.places.cancelSchedule);
  const [busyId, setBusyId] = useState<Id<'placeInterests'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCallSlug, setOpenCallSlug] = useState<string | null>(null);
  const [scheduleOpenSlug, setScheduleOpenSlug] = useState<string | null>(null);

  const withCalls = useMemo(
    () => (interests ?? []).filter((row) => row.lastCall),
    [interests],
  );
  const withSchedules = useMemo(
    () => (interests ?? []).filter((row) => row.scheduledCall),
    [interests],
  );

  const call = async (interestId: Id<'placeInterests'>) => {
    setError(null);
    setBusyId(interestId);
    try {
      const { callId } = await callSaved({ interestId, guestKey: getGuestKey() });
      router.push(`/app/calls/${callId}`);
    } catch (err) {
      setError(cleanError(err, 'Could not start the call'));
    } finally {
      setBusyId(null);
    }
  };

  const schedule = async (interestId: Id<'placeInterests'>, delayMinutes: number) => {
    setError(null);
    setBusyId(interestId);
    try {
      await scheduleCall({ interestId, delayMinutes, guestKey: getGuestKey() });
      setScheduleOpenSlug(null);
    } catch (err) {
      setError(cleanError(err, 'Could not schedule the call'));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (interestId: Id<'placeInterests'>) => {
    setError(null);
    setBusyId(interestId);
    try {
      await cancelSchedule({ interestId, guestKey: getGuestKey() });
    } catch (err) {
      setError(cleanError(err, 'Could not cancel the schedule'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-4 pb-16">
      <header className="flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Back to your team"
          className="grid size-11 place-items-center rounded-full border border-line text-text-2 hover:bg-raised hover:text-chalk"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-[22px] leading-7 font-extrabold">My places</h1>
          <p className="text-[13px] leading-[19px] text-text-3">
            Call, schedule, or review last recordings
          </p>
        </div>
        <ButtonLink href="/app/swipe" variant="secondary" className="min-h-10 px-3 text-[13px]">
          <Sparkles size={14} aria-hidden /> Find more
        </ButtonLink>
      </header>

      <p className="mt-4 flex items-start gap-2 rounded-[16px] border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-text-2">
        <span className="mt-1.5 shrink-0">
          <AgentDot color={AGENT_COLOR.caller} size={10} />
        </span>
        <span>
          Dials <strong className="text-chalk">DEMO_CALL_TO</strong> only. Guardrails: no second call
          to the same number within 1 minute; max 20/day. If the receiver asks to call back later,
          Caller auto-schedules it.
        </span>
      </p>

      {error && (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-[#F25C8A]">
          {error}
        </p>
      )}

      {interests === undefined && (
        <p className="mt-10 text-center text-text-3">Loading your places…</p>
      )}

      {interests && interests.length === 0 && (
        <div className="mt-12 grid place-items-center rounded-[20px] border border-dashed border-line px-6 py-14 text-center">
          <Heart size={28} className="text-text-3" aria-hidden />
          <p className="mt-3 text-[18px] font-extrabold">No saved places yet</p>
          <p className="mt-1 max-w-sm text-[14px] text-text-2">
            Enter an address with Scout and right-swipe places you like. They show up here so you can
            call or schedule when you’re ready.
          </p>
          <ButtonLink href="/app/swipe" className="mt-5">
            <Sparkles size={16} aria-hidden /> Find my place
          </ButtonLink>
        </div>
      )}

      {withSchedules.length > 0 && (
        <section
          aria-label="Upcoming scheduled calls"
          className="mt-6 rounded-[20px] border border-line bg-surface p-4"
        >
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
            <CalendarClock size={18} className="text-caller" aria-hidden />
            Upcoming calls
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {withSchedules.map((row) => {
              const sched = row.scheduledCall!;
              return (
                <li key={`sched-${row.placeSlug}`}>
                  <a
                    href={`#place-${row.placeSlug}`}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-ink/40 px-3 py-2.5 hover:bg-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{row.placeTitle}</span>
                      <span className="block text-[12px] text-text-3">
                        {formatWhen(sched.scheduledFor)}
                        {sched.scheduleSource === 'receiver' ? ' · auto callback' : ' · scheduled'}
                      </span>
                    </span>
                    <ChevronDown size={16} className="shrink-0 -rotate-90 text-text-3" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {withCalls.length > 0 && (
        <section
          aria-label="Last recordings by place"
          className="mt-6 rounded-[20px] border border-line bg-surface p-4"
        >
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
            <MessageSquareText size={18} className="text-caller" aria-hidden />
            Last recordings by place
          </h2>
          <p className="mt-1 text-[13px] text-text-3">
            Jump to a place to replay audio and read the Caller ↔ receiver transcript.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {withCalls.map((row) => {
              const seed = placeBySlug(row.placeSlug);
              const last = row.lastCall!;
              const when = last.endedAt ?? last.startedAt;
              return (
                <li key={`rec-${row.placeSlug}`}>
                  <a
                    href={`#place-${row.placeSlug}`}
                    onClick={() => setOpenCallSlug(row.placeSlug)}
                    className="flex items-center gap-3 rounded-[14px] border border-line bg-ink/40 px-3 py-2.5 hover:bg-raised"
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-[10px] bg-raised">
                      <Image
                        src={seed?.image ?? '/places/oak-hollow.jpg'}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">{row.placeTitle}</span>
                      <span className="block text-[12px] text-text-3">
                        {STATUS_LABEL[last.status] ?? last.status}
                        {when ? ` · ${formatWhen(when)}` : ''}
                        {last.hasPlayableRecording
                          ? ' · recording ready'
                          : last.transcript.length
                            ? ` · ${last.transcript.length} lines`
                            : ''}
                      </span>
                    </span>
                    <ChevronDown size={16} className="shrink-0 -rotate-90 text-text-3" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {interests && interests.length > 0 && (
        <ul className="mt-5 flex flex-col gap-4">
          {interests.map((row) => {
            const seed = placeBySlug(row.placeSlug);
            const image = seed?.image ?? '/places/oak-hollow.jpg';
            const address = seed?.address ?? row.addressQuery;
            const busy = busyId === row._id;
            const last = row.lastCall as LastCall | null;
            const scheduled = row.scheduledCall as ScheduledCall | null;
            const open = openCallSlug === row.placeSlug;
            const scheduleOpen = scheduleOpenSlug === row.placeSlug;
            return (
              <li
                key={row._id}
                id={`place-${row.placeSlug}`}
                className="scroll-mt-4 overflow-hidden rounded-[20px] border border-line bg-surface shadow-[var(--shadow-float)]"
              >
                <div className="relative h-40 w-full bg-raised">
                  <Image
                    src={image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 672px) 100vw, 672px"
                  />
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[20px] leading-6 font-extrabold">{row.placeTitle}</h2>
                      <p className="mt-0.5 text-[13px] text-text-2">
                        {row.unitType} · ${row.rent}/mo
                      </p>
                      <p className="mt-1 flex items-start gap-1 text-[12px] leading-4 text-text-3">
                        <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
                        {address}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-window-dim px-2 py-0.5 text-[12px] font-bold text-good">
                      Saved
                    </span>
                  </div>

                  {scheduled && (
                    <div className="rounded-[14px] border border-caller/40 bg-[#3a2a22] px-3 py-2.5">
                      <p className="text-[13px] font-bold text-caller">
                        Caller will ring you at {formatWhen(scheduled.scheduledFor)}
                      </p>
                      {scheduled.scheduleSource === 'receiver' ? (
                        <p className="mt-0.5 text-[12px] text-text-2">
                          Auto: {scheduled.scheduleReason ?? 'receiver asked for a callback'}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[12px] text-text-2">
                          {scheduled.scheduleReason ?? 'Scheduled by you'}
                        </p>
                      )}
                      <Button
                        variant="secondary"
                        className="mt-2 min-h-9 w-full text-[13px]"
                        disabled={busy || busyId !== null}
                        onClick={() => void cancel(row._id)}
                      >
                        <X size={14} aria-hidden /> Cancel schedule
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy || busyId !== null}
                      onClick={() => void call(row._id)}
                    >
                      <Phone size={16} aria-hidden />
                      {busy && busyId === row._id
                        ? 'Working…'
                        : last
                          ? 'Recall my number'
                          : 'Call my number'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={busy || busyId !== null}
                      aria-expanded={scheduleOpen}
                      onClick={() =>
                        setScheduleOpenSlug(scheduleOpen ? null : row.placeSlug)
                      }
                    >
                      <CalendarClock size={16} aria-hidden />
                      {scheduled ? 'Reschedule' : 'Schedule'}
                    </Button>
                    {last && (
                      <Button
                        variant="secondary"
                        className="flex-1"
                        aria-expanded={open}
                        onClick={() => setOpenCallSlug(open ? null : row.placeSlug)}
                      >
                        <MessageSquareText size={16} aria-hidden />
                        {open ? 'Hide last call' : 'Last call'}
                      </Button>
                    )}
                  </div>

                  {scheduleOpen && (
                    <div className="rounded-[14px] border border-line bg-ink/40 p-3">
                      <p className="text-[12px] font-bold text-text-2">Call me in…</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {SCHEDULE_PRESETS.map((p) => (
                          <Button
                            key={p.minutes}
                            variant="secondary"
                            className="min-h-10 px-2 text-[13px]"
                            disabled={busy || busyId !== null}
                            onClick={() => void schedule(row._id, p.minutes)}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!last && !scheduled && (
                    <p className="text-[12px] text-text-3">
                      No call yet. Call now or schedule — Caller only rings your DEMO_CALL_TO number.
                    </p>
                  )}

                  {last && open && <LastCallPanel placeTitle={row.placeTitle} last={last} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LastCallPanel({ placeTitle, last }: { placeTitle: string; last: LastCall }) {
  const when = last.endedAt ?? last.startedAt;
  const isMock = last.mode === 'mock' || last.isExample;

  return (
    <div className="rounded-[16px] border border-line bg-ink/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-bold">
          Last call · {STATUS_LABEL[last.status] ?? last.status}
        </p>
        {when && <p className="text-[12px] text-text-3">{formatWhen(when)}</p>}
      </div>
      <p className="mt-1 text-[12px] text-text-3">
        What Caller said to the receiver about {placeTitle}
        {isMock ? ' (example transcript)' : ''}.
      </p>

      {last.answers && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {last.answers.rent != null && (
            <AnswerChip label="Rent" value={`$${last.answers.rent}/mo`} />
          )}
          {last.answers.specials && (
            <AnswerChip label="Specials" value={last.answers.specials} />
          )}
          {last.answers.noSSNOptions && (
            <AnswerChip label="No SSN" value={last.answers.noSSNOptions} />
          )}
        </div>
      )}

      {last.hasPlayableRecording && last.recordingUrl ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-bold text-text-2">Recording</p>
          <audio controls src={last.recordingUrl} className="w-full" preload="metadata" />
        </div>
      ) : (
        !isMock &&
        last.status === 'done' && (
          <p className="mt-3 text-[12px] text-text-3">
            {last.recordingStatus === 'pending'
              ? 'Recording still saving from Vapi…'
              : 'No playable recording for this call.'}
          </p>
        )
      )}

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {last.transcript.length === 0 ? (
          <p className="text-[13px] text-text-3">
            {last.status === 'live' || last.status === 'ringing'
              ? 'Call still in progress — open the live call page for the full transcript.'
              : 'No transcript lines saved for this call.'}
          </p>
        ) : (
          last.transcript.map((line, i) => {
            const agent = line.speaker === 'caller';
            return (
              <div
                key={`${line.at}-${i}`}
                className={`flex gap-2 ${agent ? 'justify-start' : 'justify-end'}`}
              >
                {agent && (
                  <span className="mt-2 shrink-0">
                    <AgentDot color={AGENT_COLOR.caller} size={14} />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-5 ${
                    agent ? 'bg-[#3a2a22] text-chalk' : 'bg-raised text-chalk'
                  }`}
                >
                  <p
                    className={`mb-0.5 text-[11px] font-bold ${agent ? 'text-caller' : 'text-text-3'}`}
                  >
                    {agent ? 'Caller' : 'Receiver'}
                  </p>
                  {line.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ButtonLink
        href={`/app/calls/${last.callId}`}
        variant="secondary"
        className="mt-3 w-full min-h-10 text-[13px]"
      >
        Open full call page
      </ButtonLink>
    </div>
  );
}

function AnswerChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-2.5 py-2">
      <p className="text-[11px] font-bold text-text-3">{label}</p>
      <p className="text-[13px] leading-4 font-semibold">{value}</p>
    </div>
  );
}
