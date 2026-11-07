'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAction, useQuery } from 'convex/react';
import { ArrowLeft, Loader2, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { startCallListen, type ListenState } from '@/lib/callListen';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  ringing: 'Ringing',
  live: 'In progress',
  done: 'Ended',
  failed: 'Failed',
  emailed: 'Emailed',
};

/**
 * Live call page: transcript + optional Vapi listenUrl audio + recording playback.
 */
export function CallView({ callId }: { callId: Id<'calls'> }) {
  const call = useQuery(api.calls.get, { callId });
  const syncCall = useAction(api.calls.syncCall);
  const endCall = useAction(api.calls.endCall);

  const [listenState, setListenState] = useState<ListenState>('idle');
  const [listenDetail, setListenDetail] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const listen = useRef<ReturnType<typeof startCallListen> | null>(null);

  const ended = call?.status === 'done' || call?.status === 'failed';
  const isMock = call?.mode === 'mock' || call?.isExample;
  const recordingPending =
    ended && !isMock && !call?.hasPlayableRecording && call?.recordingStatus !== 'unavailable';
  const inProgress = Boolean(call && !ended);

  // Poll Vapi while live; after end, keep syncing until a playable recording lands.
  useEffect(() => {
    if (!call || isMock) return;
    if (ended && (call.hasPlayableRecording || call.recordingStatus === 'unavailable')) return;

    let cancelled = false;
    const tick = async () => {
      try {
        await syncCall({ callId });
      } catch (err) {
        console.warn('[CallView.sync]', err);
      }
    };
    void tick();
    const id = window.setInterval(() => {
      if (!cancelled) void tick();
    }, ended ? 4000 : 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    callId,
    call?.status,
    call?.hasPlayableRecording,
    call?.recordingStatus,
    isMock,
    ended,
    syncCall,
    call,
  ]);

  // Auto-scroll transcript.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [call?.transcript.length]);

  useEffect(() => {
    return () => {
      listen.current?.stop();
      listen.current = null;
    };
  }, []);

  const startListening = () => {
    if (!call?.listenUrl || ended) return;
    listen.current?.stop();
    setListenDetail(null);
    try {
      listen.current = startCallListen(call.listenUrl, (s, detail) => {
        setListenState(s);
        if (detail) setListenDetail(detail);
      });
      listen.current.setMuted(muted);
    } catch (err) {
      setListenState('error');
      setListenDetail(err instanceof Error ? err.message : 'Could not start live listen');
    }
  };

  const stopListening = () => {
    listen.current?.stop();
    listen.current = null;
    setListenState('idle');
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    listen.current?.setMuted(next);
  };

  const hangUp = async () => {
    setEnding(true);
    try {
      stopListening();
      await endCall({ callId });
    } finally {
      setEnding(false);
    }
  };

  if (call === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink text-text-2">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-caller" aria-hidden />
          <p>Loading call…</p>
        </div>
      </main>
    );
  }
  if (call === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <p className="text-text-2">Call not found.</p>
        <Link href="/app" className="mt-3 font-bold text-window">
          Back to app
        </Link>
      </main>
    );
  }

  const audioMode = (() => {
    if (listenState === 'listening' || listenState === 'connecting') return 'Live listen';
    if (ended && call.hasPlayableRecording) return 'Recording playback';
    if (recordingPending) return 'Preparing recording…';
    if (ended && call.recordingStatus === 'unavailable') return 'Recording unavailable';
    if (isMock) return 'Example transcript (no live audio)';
    if (listenState === 'error') return 'Transcript only (live audio unavailable)';
    if (call.listenUrl && !ended) return 'Live audio available — tap Listen live';
    return 'Transcript only';
  })();

  return (
    <main className="flex min-h-dvh flex-col bg-ink text-chalk">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link
          href="/app"
          className="grid size-11 place-items-center rounded-full hover:bg-raised"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="relative grid size-10 place-items-center rounded-full bg-caller/20 text-caller">
          <Phone size={18} aria-hidden />
          {inProgress && (
            <span
              className="absolute inset-0 animate-ping rounded-full bg-caller/30"
              aria-hidden
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{call.toNumber ?? 'Unknown number'}</p>
          <p className="text-[13px] text-text-3">
            Caller · {isMock ? 'Example' : 'Live'}
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold ${
            inProgress ? 'border-caller/50 text-caller' : 'border-line'
          }`}
        >
          {inProgress && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {STATUS_LABEL[call.status] ?? call.status}
        </span>
      </header>

      <p className="border-b border-line bg-surface px-4 py-2 text-[13px] text-text-2">
        Audio mode: <span className="font-semibold text-chalk">{audioMode}</span>
        {listenDetail ? ` — ${listenDetail}` : ''}
      </p>

      {inProgress && (
        <div
          className="flex items-center gap-4 border-b border-line bg-surface/80 px-4 py-3"
          aria-live="polite"
        >
          <CallPulse />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-caller">
              {call.status === 'ringing'
                ? isMock
                  ? 'Example call playing…'
                  : call.externalId
                    ? 'Ringing your phone…'
                    : 'Connecting to carrier…'
                : 'Call in progress'}
            </p>
            <p className="text-[13px] text-text-3">
              {isMock
                ? 'This is a scripted demo — your phone will not ring.'
                : 'Transcript updates live. You can listen in or wait for the recording after hang-up.'}
            </p>
          </div>
          <WaveBars />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {call.disclosureSaid && (
          <p className="rounded-[12px] border border-window/40 bg-window-dim px-3 py-2 text-[13px] font-semibold text-window">
            AI disclosure said
          </p>
        )}

        {call.transcript.length === 0 && inProgress && (
          <div className="flex flex-col items-center gap-3 py-10 text-text-3">
            <Loader2 className="size-7 animate-spin text-caller" aria-hidden />
            <p className="text-[14px] font-semibold">Waiting for the conversation to start…</p>
          </div>
        )}

        {call.transcript.map((line: { speaker: string; text: string; at: number }, i: number) => {
          const agent = line.speaker === 'caller';
          return (
            <div
              key={`${line.at}-${i}`}
              className={`flex gap-2 ${agent ? 'justify-start' : 'justify-end'}`}
            >
              {agent && (
                <span className="mt-2 shrink-0">
                  <AgentDot color="#ff8a4c" size={16} />
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-[16px] px-3 py-2 text-[14px] leading-5 ${
                  agent ? 'bg-[#3a2a22] text-chalk' : 'bg-raised text-chalk'
                }`}
              >
                {!agent && <p className="mb-0.5 text-[11px] font-bold text-text-3">Person</p>}
                {agent && <p className="mb-0.5 text-[11px] font-bold text-caller">Caller</p>}
                {line.text}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {ended && call.answers && (
        <section className="border-t border-line px-4 py-4">
          <h2 className="mb-2 text-[14px] font-bold">Answers · from this call</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {call.answers.rent != null && (
              <AnswerCard label="Rent" value={`$${call.answers.rent}/mo`} />
            )}
            {call.answers.specials && (
              <AnswerCard label="Specials" value={call.answers.specials} />
            )}
            {call.answers.noSSNOptions && (
              <AnswerCard label="No SSN" value={call.answers.noSSNOptions} />
            )}
          </div>
          {isMock && (
            <p className="mt-2 text-[12px] font-bold text-text-3">Example data</p>
          )}
        </section>
      )}

      {ended && !isMock && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-[13px] font-bold text-text-2">Recording</p>
          {call.hasPlayableRecording && call.recordingUrl ? (
            <audio controls src={call.recordingUrl} className="w-full" preload="metadata" />
          ) : recordingPending ? (
            <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-3 text-[14px] text-text-2">
              <Loader2 className="size-5 shrink-0 animate-spin text-caller" aria-hidden />
              <span>Saving recording from Vapi… this can take up to a minute after hang-up.</span>
            </div>
          ) : (
            <p className="text-[13px] text-text-3">
              No recording available for this call.
            </p>
          )}
        </div>
      )}

      {ended && isMock && (
        <div className="border-t border-line px-4 py-3 text-[13px] text-text-3">
          Example calls use a scripted transcript — there is no audio recording.
        </div>
      )}

      {call.error && (
        <p className="px-4 pb-2 text-[13px] font-semibold text-[#F25C8A]">{call.error}</p>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {!ended && call.listenUrl && !isMock && (
          <>
            {listenState === 'listening' || listenState === 'connecting' ? (
              <Button variant="secondary" onClick={stopListening}>
                Stop listening
              </Button>
            ) : (
              <Button variant="secondary" onClick={startListening}>
                <Volume2 size={16} aria-hidden /> Listen live
              </Button>
            )}
            {(listenState === 'listening' || listenState === 'connecting') && (
              <button
                onClick={toggleMute}
                className="grid size-11 place-items-center rounded-full border border-line hover:bg-raised"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}
            {(listenState === 'listening' || listenState === 'connecting') && (
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-caller">
                <span className="size-2 animate-pulse rounded-full bg-caller" aria-hidden />
                {listenState === 'connecting' ? 'Connecting…' : 'Listening'}
              </span>
            )}
          </>
        )}
        {!ended && (
          <Button
            variant="secondary"
            onClick={hangUp}
            disabled={ending}
            className="ml-auto border-[#F25C8A]/40 text-[#F25C8A]"
          >
            <PhoneOff size={16} aria-hidden />
            {ending ? 'Ending…' : 'End call'}
          </Button>
        )}
        {ended && (
          <Link href="/app" className="ml-auto text-[14px] font-bold text-window">
            Back to app
          </Link>
        )}
      </footer>
    </main>
  );
}

function CallPulse() {
  return (
    <div className="relative grid size-12 shrink-0 place-items-center" aria-hidden>
      <span className="absolute size-12 animate-ping rounded-full bg-caller/25" />
      <span className="absolute size-9 animate-pulse rounded-full bg-caller/30" />
      <span className="relative grid size-10 place-items-center rounded-full bg-caller text-ink">
        <Phone size={18} />
      </span>
    </div>
  );
}

function WaveBars() {
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="call-wave-bar w-1 origin-bottom rounded-full bg-caller"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

function AnswerCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-3 py-2">
      <p className="text-[11px] font-bold tracking-wide text-text-3 uppercase">{label}</p>
      <p className="mt-1 text-[14px] leading-5 font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-text-3">from this call</p>
    </div>
  );
}
