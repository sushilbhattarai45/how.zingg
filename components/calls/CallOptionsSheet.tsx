'use client';

/**
 * Shown right after a place is added to My list: call now, call in 1 min, or schedule.
 * Always dials DEMO_CALL_TO via the places calling pipeline.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAction } from 'convex/react';
import { CalendarClock, Phone, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENT_COLOR } from '@/content/agents';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getGuestKey } from '@/lib/guestKey';

const PRESETS = [
  { label: 'Call in 1 min', minutes: 1 },
  { label: 'Call in 5 min', minutes: 5 },
  { label: 'Call in 15 min', minutes: 15 },
  { label: 'Call in 1 hour', minutes: 60 },
] as const;

function cleanError(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  return err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').replace(/^Uncaught Error:\s*/i, '');
}

export function CallOptionsSheet({
  open,
  onClose,
  interestId,
  placeTitle,
}: {
  open: boolean;
  onClose: () => void;
  interestId: Id<'placeInterests'> | null;
  placeTitle: string;
}) {
  const router = useRouter();
  const callSaved = useAction(api.places.callSaved);
  const scheduleCall = useAction(api.places.scheduleCall);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    if (!interestId || busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(cleanError(err, 'Could not start or schedule the call'));
      setBusy(false);
    }
  };

  const callNow = () =>
    void run(async () => {
      const { callId } = await callSaved({ interestId: interestId!, guestKey: getGuestKey() });
      onClose();
      router.push(`/app/calls/${callId}`);
    });

  const schedule = (delayMinutes: number) =>
    void run(async () => {
      await scheduleCall({
        interestId: interestId!,
        delayMinutes,
        reason: `Scheduled from chat (${delayMinutes} min)`,
        guestKey: getGuestKey(),
      });
      onClose();
      setBusy(false);
    });

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Call about this place?"
      avatar={<AgentDot color={AGENT_COLOR.caller} size={22} />}
      width={440}
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[14px] leading-5 text-text-2">
          <strong className="text-chalk">{placeTitle}</strong> is on your list. Caller can ring your{' '}
          <code className="font-mono text-[12px]">DEMO_CALL_TO</code> number now, or after a short
          wait. You&apos;ll see every call in the conversation thread.
        </p>

        <Button className="w-full" disabled={busy || !interestId} onClick={callNow}>
          <Phone size={16} aria-hidden />
          {busy ? 'Working…' : 'Call my number now'}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.minutes}
              variant="secondary"
              className="min-h-11 text-[13px]"
              disabled={busy || !interestId}
              onClick={() => schedule(p.minutes)}
            >
              <CalendarClock size={14} aria-hidden />
              {p.label}
            </Button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-[14px] font-semibold text-[#F25C8A]">
            {error}
          </p>
        )}

        <Button variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
          <X size={14} aria-hidden /> Not now — I&apos;ll call later
        </Button>
      </div>
    </Sheet>
  );
}
