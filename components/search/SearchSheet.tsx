'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { AgentDot } from '@/components/ui/AgentDot';
import { BotAvatar, type BotMood } from '@/components/ui/BotAvatar';
import { Button } from '@/components/ui/Button';
import { AGENT_COLOR } from '@/content/agents';
import { answerExample, type AskAnswer } from '@/lib/askExample';

export const EXAMPLE_PROMPTS = [
  'Cheapest 1 bed under $700 near USM',
  'Nearest Walmart from campus',
  'Indian or Nepali groceries near USM',
  'Banks that open an account without an SSN',
  "Is Oak Hollow's 1 bed free on Aug 14?",
];

type Phase = 'idle' | 'thinking' | 'answering' | 'done';

const STEP_MS = 900;
const CHARS_PER_SEC = 38;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * "Ask the team". Concierge sits beside the conversation: it reads while it thinks, then answers in
 * a speech bubble that types out, with a face to match. Answers come from seeded example data
 * (labeled "Example") until the live pipeline lands in M4.
 */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const run = useRef(0);

  const submit = (q: string) => {
    if (!q.trim()) return;
    const id = ++run.current;
    const a = answerExample(q);
    setQuery(q);
    setAsked(q);
    setAnswer(a);
    setStep(0);
    setTyped(0);
    setPhase('thinking');
    // Read through the steps, then answer.
    a.steps.forEach((_, i) => {
      if (i > 0) window.setTimeout(() => run.current === id && setStep(i), i * STEP_MS);
    });
    window.setTimeout(
      () => {
        if (run.current !== id) return;
        if (reduced) {
          setTyped(a.say.length);
          setPhase('done');
        } else setPhase('answering');
      },
      reduced ? 0 : a.steps.length * STEP_MS,
    );
  };

  // Type the answer out, a few characters per frame.
  useEffect(() => {
    if (phase !== 'answering' || !answer) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const n = Math.min(answer.say.length, Math.floor(((now - start) / 1000) * CHARS_PER_SEC));
      setTyped(n);
      if (n >= answer.say.length) setPhase('done');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, answer]);

  const reset = () => {
    run.current++;
    setPhase('idle');
    setAsked(null);
    setAnswer(null);
    setQuery('');
  };

  const mood: BotMood =
    phase === 'thinking'
      ? 'thinking'
      : phase === 'idle' || !answer
        ? 'idle'
        : answer.mood === 'sad'
          ? 'sad'
          : answer.mood === 'happy'
            ? 'happy'
            : 'idle';
  const moodLabel = {
    idle: 'listening',
    thinking: 'thinking',
    happy: 'found something',
    sad: 'still looking',
  }[mood];

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Ask the team"
      avatar={<AgentDot color={AGENT_COLOR.concierge} size={28} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex items-center gap-2 rounded-[16px] border border-line bg-raised p-1.5 pl-2"
      >
        <span className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-bold">USM</span>
        <label htmlFor="ask-input" className="sr-only">
          Ask anything about living near USM
        </label>
        <input
          id="ask-input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about living near USM…"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-text-3"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="grid size-11 place-items-center rounded-[12px] bg-window text-ink hover:bg-window-hi"
        >
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </form>

      {/* Concierge and its speech bubble */}
      <div className="mt-4 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <SpeechBubble>
            {phase === 'idle' && <span>Hi! What can I help you find near USM?</span>}
            {phase === 'thinking' && answer && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="inline-flex items-center gap-2 text-text-2"
                >
                  <ThinkingDots reduced={reduced} />
                  {answer.steps[step]}
                </motion.span>
              </AnimatePresence>
            )}
            {(phase === 'answering' || phase === 'done') && answer && (
              <>
                <span className="sr-only" role="status">
                  {answer.say}
                </span>
                <span aria-hidden>
                  {answer.say.slice(0, typed)}
                  {phase === 'answering' && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-text-3" />
                  )}
                </span>
              </>
            )}
          </SpeechBubble>
          {asked && (
            <p className="mt-2 truncate pl-3 text-[12px] leading-4 text-text-3">
              You asked: &ldquo;{asked}&rdquo;
            </p>
          )}
        </div>
        <div className="shrink-0">
          <BotAvatar color={AGENT_COLOR.concierge} mood={mood} size={96} label={`Concierge, ${moodLabel}`} />
          <p className="text-center text-[12px] leading-4 font-bold">Concierge</p>
        </div>
      </div>

      {phase === 'idle' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="min-h-11 rounded-full border border-line px-3 text-left text-[13px] font-bold text-text-2 hover:bg-raised hover:text-chalk"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {phase === 'done' && answer && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-4"
          >
            {answer.kind === 'live' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary">Add to wishlist and ask Caller</Button>
                <Button variant="secondary">Just add to wishlist</Button>
                <Button variant="secondary">Not now</Button>
              </div>
            )}
            {answer.results.length > 0 && (
              <ul className="flex flex-col gap-2">
                {answer.results.map((r, i) => (
                  <motion.li
                    key={r.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: reduced ? 0 : i * 0.08, ease: EASE }}
                    className="rounded-[16px] border border-line bg-card p-3"
                  >
                    <p className="flex items-center justify-between gap-2 font-bold">
                      {r.title}
                      <span className="rounded-full bg-raised px-2 py-0.5 text-[12px] leading-4 font-bold text-text-2">
                        Example
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[19px] text-text-2">{r.detail}</p>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 font-bold text-window-text underline"
                    >
                      Source <ExternalLink size={12} aria-hidden />
                    </a>
                  </motion.li>
                ))}
              </ul>
            )}
            {answer.hiddenScams > 0 && (
              <p className="mt-2 text-[12px] leading-4 text-text-3">
                {answer.hiddenScams} listing hidden: asked for a wire transfer.
              </p>
            )}
            <button
              onClick={reset}
              className="mt-3 min-h-11 rounded-full px-3 text-[13px] font-bold text-text-2 hover:bg-raised"
            >
              Ask something else
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

/** Rounded bubble with a tail pointing right, toward the bot. */
function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[64px] rounded-[16px] border border-line bg-card px-4 py-3 text-[15px] leading-[22px] font-semibold">
      {children}
      <span
        aria-hidden
        className="absolute -right-[7px] bottom-6 size-3 rotate-45 border-t border-r border-line bg-card"
      />
    </div>
  );
}

function ThinkingDots({ reduced }: { reduced: boolean }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full"
          style={{ background: AGENT_COLOR.concierge }}
          animate={reduced ? {} : { opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
