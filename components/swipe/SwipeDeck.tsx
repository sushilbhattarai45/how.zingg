'use client';

/**
 * "Find your place": Scout searches, then presents places one at a time. Swipe (or tap) yes or no.
 * Scout reacts: excited on a yes, embarrassed on a no. Every yes goes straight to the team:
 * Caller schedules a call, Packet asks for what's missing, Closer hunts for a deal.
 * UI demo on seeded example data (labeled "Example").
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react';
import { ArrowLeft, Check, ExternalLink, Footprints, IdCard, Upload, X } from 'lucide-react';
import { BotAvatar, type BotMood } from '@/components/ui/BotAvatar';
import { Button } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENTS, AGENT_COLOR } from '@/content/agents';
import { buildDeck, hiddenScams, tasksFor, type SwipeCard, type TeamTask } from '@/lib/swipeDeck';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const SEARCH_STEPS = [
  'Reading listings near USM…',
  'Hiding a scam that wants a wire…',
  'Ranking by walk time to class…',
];
const NOPE_LINES = [
  "Oops… not your style? The next one's better, promise!",
  'Hehe, my bad. Let me show you another.',
  "Noted! I'll skip places like that.",
];
const YES_LINES = [
  'Yes! Great pick! Team, let’s go!',
  'Ooh, I love that one too! On it!',
  'Wishlisted! Handing it to the team!',
];

type Phase = 'searching' | 'presenting' | 'reacting' | 'done';
type Pick = { card: SwipeCard; tasks: TeamTask[] };

export function SwipeDeck() {
  const deck = useMemo(() => buildDeck(), []);
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>('searching');
  const [step, setStep] = useState(0);
  const [index, setIndex] = useState(0);
  const [mood, setMood] = useState<BotMood>('searching');
  const [line, setLine] = useState(SEARCH_STEPS[0]!);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [toss, setToss] = useState(0);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, reduced ? 0 : ms));

  const present = useCallback(
    (i: number) => {
      const card = deck[i];
      if (!card) {
        setPhase('done');
        setMood('happy');
        setLine("That's everyone for now! I'll keep looking and ping you when new places show up.");
        return;
      }
      setPhase('presenting');
      setMood(i === 0 ? 'excited' : 'happy');
      setLine(i === 0 ? `Found ${deck.length} places! First up: ${card.pitch}` : card.pitch);
    },
    [deck],
  );

  // Search, then present the first card.
  useEffect(() => {
    const ts = timers.current;
    SEARCH_STEPS.forEach((s, i) =>
      ts.push(
        window.setTimeout(
          () => {
            setStep(i);
            setLine(s);
          },
          reduced ? 0 : i * 1100,
        ),
      ),
    );
    ts.push(window.setTimeout(() => present(0), reduced ? 0 : SEARCH_STEPS.length * 1100 + 300));
    return () => ts.forEach(clearTimeout);
  }, [present, reduced]);

  const decide = (yes: boolean) => {
    const card = deck[index];
    if (!card || phase !== 'presenting') return;
    setPhase('reacting');
    if (yes) {
      setMood('excited');
      setLine(YES_LINES[picks.length % YES_LINES.length]!);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setToss((n) => n + 1);
      later(() => setPicks((p) => [{ card, tasks: tasksFor(card, tz) }, ...p]), 450);
    } else {
      setMood('embarrassed');
      setLine(NOPE_LINES[index % NOPE_LINES.length]!);
    }
    setIndex((i) => i + 1);
    later(() => present(index + 1), yes ? 1700 : 1900);
  };

  const card = deck[index];
  const next = deck[index + 1];

  return (
    <div className="mx-auto grid min-h-dvh max-w-6xl gap-6 px-4 pt-4 pb-10 lg:grid-cols-[minmax(0,480px)_1fr] lg:gap-10">
      {/* Left: Scout and the deck */}
      <section aria-label="Places" className="flex flex-col">
        <header className="flex items-center gap-3">
          <Link
            href="/app"
            aria-label="Back to your team"
            className="grid size-11 place-items-center rounded-full border border-line text-text-2 hover:bg-raised hover:text-chalk"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-[22px] leading-7 font-extrabold">Find your place</h1>
            <p className="text-[13px] leading-[19px] text-text-3">
              {phase === 'searching'
                ? 'Scout is searching…'
                : `${Math.min(index + 1, deck.length)} of ${deck.length} · near USM`}
            </p>
          </div>
        </header>

        {/* Scout presents */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <BotAvatar color={AGENT_COLOR.scout} mood={mood} size={84} label={`Scout, ${mood}`} />
            <Toss key={toss} active={toss > 0} reduced={reduced} />
          </div>
          <div className="relative min-h-[64px] flex-1 rounded-[16px] border border-line bg-surface px-4 py-3">
            <span
              aria-hidden
              className="absolute top-1/2 -left-[7px] size-3 -translate-y-1/2 rotate-45 border-b border-l border-line bg-surface"
            />
            <p className="label-caps flex items-center gap-1.5 text-text-3">
              <AgentDot color={AGENT_COLOR.scout} size={8} /> Scout
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={line}
                role="status"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="mt-0.5 text-[15px] leading-[22px] font-semibold"
              >
                {line}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Deck */}
        <div className="relative mt-5 h-[440px]">
          <AnimatePresence>
            {phase === 'searching' && <Searching key="searching" step={step} reduced={reduced} />}
          </AnimatePresence>
          {phase !== 'searching' && phase !== 'done' && (
            <>
              {next && <CardView key={`${next.slug}-under`} card={next} under />}
              <AnimatePresence custom={0}>
                {card && (
                  <Draggable
                    key={card.slug}
                    card={card}
                    disabled={phase !== 'presenting'}
                    onDecide={decide}
                    reduced={reduced}
                  />
                )}
              </AnimatePresence>
            </>
          )}
          {phase === 'done' && (
            <div className="grid h-full place-items-center rounded-[20px] border border-dashed border-line p-6 text-center">
              <div>
                <p className="text-[18px] leading-6 font-extrabold">
                  {picks.length ? `${picks.length} on your wishlist` : 'No picks this time'}
                </p>
                <p className="mt-1 text-text-2">
                  {hiddenScams()} scam listing hidden. New places show up as Scout finds them.
                </p>
                <Link
                  href="/app"
                  className="mt-4 inline-block font-bold text-window underline underline-offset-2"
                >
                  Back to your team
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Yes / no */}
        <div className="mt-5 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={phase !== 'presenting'}
            onClick={() => decide(false)}
          >
            <X size={18} strokeWidth={2.5} aria-hidden /> Not for me
          </Button>
          <Button className="flex-1" disabled={phase !== 'presenting'} onClick={() => decide(true)}>
            <Check size={18} strokeWidth={2.5} aria-hidden /> Yes, go for it
          </Button>
        </div>
        <p className="mt-2 text-center text-[12px] leading-4 text-text-3">
          Swipe right for yes, left for no, or use ← →
        </p>
        <KeyboardSwipe enabled={phase === 'presenting'} onDecide={decide} />
      </section>

      {/* Right: the team gets to work on every yes */}
      <TeamPanel picks={picks} />
    </div>
  );
}

/* ───────────── Searching ───────────── */

const PINS: [number, number][] = [
  [28, 34],
  [62, 22],
  [74, 58],
  [40, 70],
  [18, 60],
  [56, 44],
];

function Searching({ step, reduced }: { step: number; reduced: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="absolute inset-0 overflow-hidden rounded-[20px] border border-line bg-[#20262a]"
      aria-hidden
    >
      {/* A simple map: streets and a campus block */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
        {[20, 45, 70].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y + 6} stroke="#3a4448" strokeWidth="3" />
        ))}
        {[30, 65].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x - 8} y2="100" stroke="#3a4448" strokeWidth="3" />
        ))}
        <rect x="40" y="50" width="16" height="12" rx="3" fill="#6dbd13" opacity="0.35" />
      </svg>
      {/* Radar sweep */}
      {!reduced && (
        <motion.div
          className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, rgba(61,184,201,0.35), rgba(61,184,201,0) 70deg)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {/* Pins pop in as Scout finds places */}
      {PINS.map(([x, y], i) => (
        <motion.span
          key={i}
          className="absolute grid size-7 -translate-x-1/2 -translate-y-full place-items-center"
          style={{ left: `${x}%`, top: `${y}%` }}
          initial={{ opacity: 0, y: -8, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.4 + i * 0.45, duration: 0.35, ease: EASE }}
        >
          <svg width="22" height="28" viewBox="0 0 22 28">
            <path
              d="M11 27 C11 27 2 16 2 10 a9 9 0 0 1 18 0 c0 6-9 17-9 17z"
              fill={i === 4 ? '#ff7a7a' : '#3db8c9'}
            />
            <circle cx="11" cy="10" r="3.5" fill="#fff" />
          </svg>
        </motion.span>
      ))}
      <div className="absolute inset-x-4 bottom-4 flex justify-center gap-1.5">
        {SEARCH_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-scout' : 'w-4 bg-white/20'}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ───────────── Cards ───────────── */

function Draggable({
  card,
  disabled,
  onDecide,
  reduced,
}: {
  card: SwipeCard;
  disabled: boolean;
  onDecide: (yes: boolean) => void;
  reduced: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const yes = useTransform(x, [30, 120], [0, 1]);
  const no = useTransform(x, [-120, -30], [1, 0]);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);

  const end = (_: unknown, info: PanInfo) => {
    const go =
      info.offset.x > 110 || info.velocity.x > 600
        ? 1
        : info.offset.x < -110 || info.velocity.x < -600
          ? -1
          : 0;
    if (!go) {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 26 });
      return;
    }
    setLeaving(go);
    onDecide(go === 1);
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag={disabled ? false : 'x'}
      dragSnapToOrigin={false}
      dragElastic={0.6}
      onDragEnd={end}
      initial={{ scale: 0.96, y: 8, opacity: 0.6 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0 }
          : {
              x: (leaving || (x.get() >= 0 ? 1 : -1)) * 520,
              rotate: (leaving || 1) * 18,
              opacity: 0,
              transition: { duration: 0.4, ease: EASE },
            }
      }
      transition={{ duration: 0.3, ease: EASE }}
    >
      <CardView card={card} />
      {/* Stamps */}
      <motion.span
        style={{ opacity: yes }}
        className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-[12px] border-4 border-window px-3 py-1 text-[22px] font-extrabold text-window"
      >
        YES
      </motion.span>
      <motion.span
        style={{ opacity: no }}
        className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-[12px] border-4 border-bad px-3 py-1 text-[22px] font-extrabold text-bad"
      >
        NOPE
      </motion.span>
    </motion.div>
  );
}

function CardView({ card, under }: { card: SwipeCard; under?: boolean }) {
  return (
    <article
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-[var(--shadow-float)] ${under ? 'translate-y-3 scale-[0.95] opacity-60' : ''}`}
      aria-hidden={under}
    >
      <Building hue={card.hue} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[22px] leading-7 font-extrabold">{card.title}</h2>
            <p className="text-[13px] leading-[19px] text-text-2">
              {card.unitType} · from{' '}
              {new Date(card.availableFrom + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <span className="rounded-full bg-raised px-2 py-0.5 text-[12px] leading-4 font-bold text-text-2">
            Example
          </span>
        </div>
        <p className="mt-3 text-[28px] leading-8 font-extrabold tabular">
          ${card.rent}
          <span className="text-[14px] font-bold text-text-3">
            {' '}
            / month{card.deposit !== undefined && ` · $${card.deposit} deposit`}
          </span>
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13px] leading-4 font-bold">
          {card.walkMin !== undefined && (
            <li className="flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5">
              <Footprints size={14} aria-hidden /> {card.walkMin} min walk to Scianna Hall
            </li>
          )}
          <li className="flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5">
            <IdCard size={14} aria-hidden /> {card.noSSN}
          </li>
        </ul>
        <a
          href={card.sourceUrl}
          target="_blank"
          rel="noreferrer"
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="mt-auto inline-flex w-fit items-center gap-1 pt-3 text-[12px] leading-4 font-bold text-text-3 underline underline-offset-2 hover:text-chalk"
        >
          Source <ExternalLink size={12} aria-hidden />
        </a>
      </div>
    </article>
  );
}

/** Original illustration: a small apartment building with lit windows (no stock photos). */
function Building({ hue }: { hue: number }) {
  const walls = ['#c9b79c', '#a8604a', '#8fa58a', '#d6a77a', '#8d9bb3', '#b97f6a'][Math.floor(hue * 6) % 6]!;
  const lit = (i: number) => (i * 7 + Math.floor(hue * 10)) % 3 !== 0;
  return (
    <svg
      viewBox="0 0 400 170"
      className="h-[170px] w-full shrink-0"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="170" fill="#2a2630" />
      <circle cx="340" cy="34" r="14" fill="#f7f0de" opacity="0.8" />
      <rect y="140" width="400" height="30" fill="#41603d" />
      <circle cx="40" cy="120" r="26" fill="#4f8a46" />
      <rect x="37" y="120" width="6" height="26" fill="#6b4a32" />
      <circle cx="360" cy="124" r="22" fill="#62a055" />
      <rect x="90" y="40" width="220" height="104" rx="8" fill={walls} />
      <rect x="84" y="34" width="232" height="10" rx="4" fill="#4b4548" />
      {Array.from({ length: 12 }, (_, i) => {
        const c = i % 6;
        const r = Math.floor(i / 6);
        return (
          <rect
            key={i}
            x={104 + c * 33}
            y={54 + r * 36}
            width="22"
            height="22"
            rx="4"
            fill={lit(i) ? '#ffd9a0' : '#2b2a33'}
          />
        );
      })}
      <rect x="186" y="112" width="28" height="32" rx="5" fill="#4a6e66" />
      <circle cx="208" cy="128" r="2" fill="#f2c230" />
    </svg>
  );
}

/* ───────────── Team panel ───────────── */

function TeamPanel({ picks }: { picks: Pick[] }) {
  const crew = AGENTS.filter((a) => a.id === 'caller' || a.id === 'packet' || a.id === 'closer');
  return (
    <section aria-label="Your team" className="lg:pt-[60px]">
      <div className="rounded-[20px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] leading-6 font-bold">Your team</h2>
          <div className="flex -space-x-2">
            {crew.map((a) => (
              <span key={a.id} className="rounded-full bg-surface">
                <BotAvatar
                  color={a.color}
                  mood={picks.length ? 'thinking' : 'idle'}
                  size={34}
                  label={`${a.name}, ${picks.length ? 'working' : 'waiting'}`}
                />
              </span>
            ))}
          </div>
        </div>

        {picks.length === 0 ? (
          <p className="mt-3 text-text-2">
            Say yes to a place and Caller, Packet and Closer start on it right away.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {picks.map(({ card, tasks }) => (
                <motion.li
                  key={card.slug}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="rounded-[16px] border border-line bg-ink/40 p-3"
                >
                  <p className="flex items-center justify-between gap-2 font-bold">
                    {card.title} · ${card.rent}
                    <span className="rounded-full bg-window-dim px-2 py-0.5 text-[12px] leading-4 font-bold text-good">
                      Wishlist
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {tasks.map((t, i) => (
                      <TaskRow key={t.agent} task={t} delay={0.25 + i * 0.35} />
                    ))}
                  </ul>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
        <p className="mt-4 text-[12px] leading-4 text-text-3">
          Example data. Nothing is sent or booked without your OK.
        </p>
      </div>
    </section>
  );
}

function TaskRow({ task, delay }: { task: TeamTask; delay: number }) {
  const [asked, setAsked] = useState(false);
  const name = AGENTS.find((a) => a.id === task.agent)!.name;
  return (
    <motion.li
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE }}
      className="flex items-start gap-2.5 text-[13px] leading-[19px]"
    >
      <span className="relative mt-1.5">
        <AgentDot color={AGENT_COLOR[task.agent]} size={10} />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: AGENT_COLOR[task.agent] }}
          animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, delay }}
        />
      </span>
      <span className="flex-1">
        <span className="font-bold">{name}</span> <span className="text-text-2">{task.text}</span>
        {task.action && (
          <span className="mt-1.5 block">
            {asked ? (
              <span className="text-text-3">Document upload arrives in the next build.</span>
            ) : (
              <button
                onClick={() => setAsked(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-bold hover:bg-raised"
              >
                <Upload size={13} aria-hidden /> {task.action}
              </button>
            )}
          </span>
        )}
      </span>
    </motion.li>
  );
}

/** A little paper file that flies from Scout toward the team panel on every yes. */
function Toss({ active, reduced }: { active: boolean; reduced: boolean }) {
  if (!active || reduced) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute top-6 left-10 z-20 h-7 w-6 rounded-[4px] border border-line bg-white shadow"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: [0, 220, 520], y: [0, -90, 40], rotate: [0, 160, 340], opacity: [1, 1, 0] }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    />
  );
}

/** ← / → keys decide, like the buttons. */
function KeyboardSwipe({ enabled, onDecide }: { enabled: boolean; onDecide: (yes: boolean) => void }) {
  const cb = useRef(onDecide);
  useEffect(() => {
    cb.current = onDecide;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') cb.current(true);
      if (e.key === 'ArrowLeft') cb.current(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  return null;
}
