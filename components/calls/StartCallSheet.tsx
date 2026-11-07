'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { Phone } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { api } from '@/convex/_generated/api';
import { DEFAULT_CALL_QUESTIONS } from '@/lib/rules';
import { isE164 } from '@/lib/services/voice/allowlist';

const DEFAULT_QUESTIONS_TEXT = DEFAULT_CALL_QUESTIONS.join('\n');

/**
 * Dial pad for Caller: E.164 number + editable questions → startCall → /app/calls/[id].
 */
export function StartCallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const startCall = useAction(api.calls.startCall);
  const [phone, setPhone] = useState('');
  const [questionsText, setQuestionsText] = useState(DEFAULT_QUESTIONS_TEXT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmed = phone.trim();
    if (!isE164(trimmed)) {
      setError('Use E.164 format, e.g. +16019132221');
      return;
    }
    const questions = questionsText
      .split('\n')
      .map((q) => q.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    if (!questions.length) {
      setError('Add at least one question.');
      return;
    }
    setBusy(true);
    try {
      const { callId } = await startCall({ phone: trimmed, questions });
      onClose();
      router.push(`/app/calls/${callId}`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').replace(/^Uncaught Error:\s*/i, '')
          : 'Could not start the call';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Call a number"
      avatar={<AgentDot color="#ff8a4c" size={22} />}
      width={480}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[14px] leading-5 text-text-2">
          Caller dials this number on behalf of Sushil. The first line says it is an AI, that this
          is a student project being tested and developed, and that the call is recorded for
          research. Live numbers must be on{' '}
          <code className="font-mono text-[13px]">CALL_ALLOWLIST</code>.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Phone (E.164)</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+16019132221"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-11 rounded-[12px] border border-line bg-raised px-3 text-[15px] font-semibold outline-none placeholder:text-text-3 focus:border-caller"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Questions (one per line)</span>
          <textarea
            rows={4}
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            className="rounded-[12px] border border-line bg-raised px-3 py-2 text-[14px] leading-5 font-medium outline-none focus:border-caller"
          />
        </label>

        <p className="rounded-[12px] bg-window-dim px-3 py-2 text-[13px] leading-5 text-chalk">
          Every call starts with: AI on behalf of Sushil + student project under test + recorded for
          research. Max length 3 minutes.
        </p>

        {error && (
          <p role="alert" className="text-[14px] font-semibold text-[#F25C8A]">
            {error}
          </p>
        )}

        <Button onClick={submit} disabled={busy} className="w-full">
          <Phone size={18} aria-hidden />
          {busy ? 'Starting…' : 'Start call'}
        </Button>
      </div>
    </Sheet>
  );
}
