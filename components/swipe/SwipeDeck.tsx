'use client';

/**
 * The swipe deck (middle of /app). Address → Scout "searches" hardcoded USM realty (with photos)
 * → Tinder-style swipe. Swipe LEFT (toward "My list") to add: it's saved to My Places and handed to
 * the workspace (list + conversation). Swipe right to skip. Calling happens from My Places and
 * dials DEMO_CALL_TO only.
 */
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react';
import { useAction } from 'convex/react';
import { ArrowLeft, ArrowRight, ExternalLink, Footprints, Heart, IdCard, MapPin } from 'lucide-react';
import { BotAvatar, type BotMood } from '@/components/ui/BotAvatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENT_COLOR } from '@/content/agents';
import { api } from '@/convex/_generated/api';
import {
  buildDeck,
  campusLabel,
  hiddenScams,
  tasksFor,
  type SwipeCard,
  type TeamTask,
} from '@/lib/swipeDeck';
import { getGuestKey } from '@/lib/guestKey';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const NOPE_LINES = [
  "Oops… not your style? The next one's better, promise!",
  'Hehe, my bad. Let me show you another.',
  "Noted! I'll skip places like that.",
];
const YES_LINES = [
  'Yes! Saved to My Places — call whenever you’re ready.',
  'Ooh, great pick! It’s on your wishlist now.',
  'Wishlisted! Open My Places when you want Caller to ring you.',
];

type Phase = 'address' | 'searching' | 'presenting' | 'reacting' | 'done';
type Pick = { card: SwipeCard; tasks: TeamTask[] };

/** Add = toward the list on the left; skip = right. */
const ADD = -1;
const SKIP = 1;

export function SwipeDeck({
  onAdd,
  added = 0,
  addedSlugs = [],
}: {
  /** Fired after a place is saved (or save fails). Passes interestId when Convex save succeeded. */
  onAdd?: (card: SwipeCard, interestId: string | null) => void;
  added?: number;
  /** Slugs already on My list — cannot add again. */
  addedSlugs?: string[];
}) {
  const reduced = useReducedMotion() ?? false;
  const savePlace = useAction(api.places.savePlace);
  const [address, setAddress] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [deck, setDeck] = useState<SwipeCard[]>([]);
  const [phase, setPhase] = useState<Phase>('address');
  const [step, setStep] = useState(0);
  const [index, setIndex] = useState(0);
  const [mood, setMood] = useState<BotMood>('idle');
  const [line, setLine] = useState('Where should I look in ' + campusLabel() + '?');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [toss, setToss] = useState(0);
  const [dir, setDir] = useState(SKIP);
  const [saving, setSaving] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) =>
    timers.current.push(window.setTimeout(fn, reduced ? 0 : ms));

  const searchSteps = useCallback(
    (q: string) => [
      `Reading places near “${q || campusLabel()}”…`,
      'Checking walk times, move-in dates, and no-SSN notes…',
      'Ranking the best matches for you…',
    ],
    [],
  );

  const present = useCallback(
    (i: number, cards: SwipeCard[]) => {
      const card = cards[i];
      if (!card) {
        setPhase('done');
        setMood('happy');
        setLine("That's everyone for now! I'll keep looking and ping you when new places show up.");
        return;
      }
      setPhase('presenting');
      setMood(i === 0 ? 'excited' : 'happy');
      setLine(i === 0 ? `Found ${cards.length} places! First up: ${card.pitch}` : card.pitch);
    },
    [],
  );

  const startSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setCallError('Enter an address or campus building first.');
      return;
    }
    setCallError(null);
    setAddressQuery(trimmed);
    const cards = buildDeck(trimmed);
    setDeck(cards);
    setIndex(0);
    setPicks([]);
    setPhase('searching');
    setMood('searching');
    const steps = searchSteps(trimmed);
    setLine(steps[0]!);
    setStep(0);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    steps.forEach((s, i) =>
      later(() => {
        setStep(i);
        setLine(s);
      }, i * 1100),
    );
    later(() => present(0, cards), steps.length * 1100 + 300);
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const decide = async (yes: boolean) => {
    const card = deck[index];
    if (!card || phase !== 'presenting' || saving) return;
    setPhase('reacting');
    setDir(yes ? ADD : SKIP);
    if (yes) {
      if (addedSlugs.includes(card.slug) || picks.some((p) => p.card.slug === card.slug)) {
        setMood('embarrassed');
        setLine(`${card.title} is already on your list — pick another.`);
        setCallError(null);
        setIndex((i) => i + 1);
        later(() => present(index + 1, deck), 1400);
        return;
      }
      setMood('excited');
      setLine(YES_LINES[(picks.length + added) % YES_LINES.length]!);
      setToss((n) => n + 1);
      setSaving(true);
      setCallError(null);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let interestId: string | null = null;
      let alreadySaved = false;
      try {
        const saved = await savePlace({
          placeSlug: card.slug,
          placeTitle: card.title,
          unitType: card.unitType,
          rent: card.rent,
          addressQuery,
          guestKey: getGuestKey(),
        });
        interestId = saved.interestId;
        alreadySaved = saved.alreadySaved;
        if (alreadySaved) {
          setMood('embarrassed');
          setLine(`${card.title} is already on your list.`);
        } else {
          later(() => setPicks((p) => [{ card, tasks: tasksFor(card, tz) }, ...p]), 400);
        }
      } catch (err) {
        // Still show it in the workspace; the save can be retried from My Places.
        const msg =
          err instanceof Error
            ? err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').replace(/^Uncaught Error:\s*/i, '')
            : 'Could not save the place';
        setCallError(msg);
      } finally {
        setSaving(false);
        later(() => onAdd?.(card, interestId), 300);
      }
      setIndex((i) => i + 1);
      later(() => present(index + 1, deck), alreadySaved ? 1400 : 1900);
      return;
    }
    setMood('embarrassed');
    setLine(NOPE_LINES[index % NOPE_LINES.length]!);
    setIndex((i) => i + 1);
    later(() => present(index + 1, deck), 1900);
  };

  const card = deck[index];
  const next = deck[index + 1];

  return (
      <section aria-label="Places" className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-[22px] leading-7 font-extrabold">Find your place</h1>
            <p className="text-[13px] leading-[19px] text-text-3">
              {phase === 'address'
                ? 'Enter an address — Scout will look nearby'
                : phase === 'searching'
                  ? 'Scout is searching…'
                  : deck.length
                    ? `${Math.min(index + 1, deck.length)} of ${deck.length} · ${campusLabel()}`
                    : campusLabel()}
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

        {phase === 'address' && (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startSearch(address);
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Where should I look in {campusLabel()}?</span>
              <span className="flex items-center gap-2 rounded-[16px] border border-line bg-surface px-3">
                <MapPin size={18} className="text-scout" aria-hidden />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Scianna Hall, Near Wilber Hall"
                  className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-text-3"
                  autoFocus
                />
              </span>
            </label>
            <Button type="submit" className="w-full">
              Search with Agent Scout
            </Button>
            {/* <p className="text-[12px] leading-4 text-text-3">
              Example places near {campusLabel()} (hardcoded photos — no live scrape yet). Left-swipe
              adds to My Places; call from there rings <strong>your</strong> DEMO_CALL_TO only.
            </p> */}
            {callError && (
              <p role="alert" className="text-[14px] font-semibold text-[#F25C8A]">
                {callError}
              </p>
            )}
          </form>
        )}

        {/* Deck */}
        {phase !== 'address' && (
          <div className="relative mt-5 h-[440px]">
            <AnimatePresence>
              {phase === 'searching' && (
                <Searching key="searching" step={step} steps={3} reduced={reduced} />
              )}
            </AnimatePresence>
            {phase !== 'searching' && phase !== 'done' && (
              <>
                {next && <CardView key={`${next.slug}-under`} card={next} under />}
                <AnimatePresence custom={dir}>
                  {card && (
                    <Draggable
                      key={card.slug}
                      card={card}
                      disabled={phase !== 'presenting' || saving}
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
                    {hiddenScams()
                      ? `${hiddenScams()} scam listing hidden. `
                      : ''}
                    Searched near “{addressQuery}”.
                  </p>
                  {picks.length > 0 && (
                    <ButtonLink href="/app/places" className="mt-4 w-full">
                      <Heart size={16} aria-hidden /> Go to My Places
                    </ButtonLink>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('address');
                      setMood('idle');
                      setLine('Want to try another address?');
                    }}
                    className="mt-4 font-bold text-window underline underline-offset-2"
                  >
                    Search again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase !== 'address' && phase !== 'done' && phase !== 'searching' && (
          <>
            <div className="mt-5 flex gap-3">
              <Button
                className="flex-1"
                disabled={phase !== 'presenting' || saving}
                onClick={() => void decide(true)}
              >
                <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
                {saving ? 'Saving…' : 'Add to my list'}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={phase !== 'presenting' || saving}
                onClick={() => void decide(false)}
              >
                Skip <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </Button>
            </div>
            <p className="mt-2 text-center text-[12px] leading-4 text-text-3">
              Swipe left to add · right to skip · call from My Places
            </p>
            {picks.length > 0 && (
              <ButtonLink href="/app/places" variant="secondary" className="mt-3 w-full">
                <Heart size={16} aria-hidden /> My Places ({picks.length})
              </ButtonLink>
            )}
            {callError && (
              <p role="alert" className="mt-2 text-center text-[13px] font-semibold text-[#F25C8A]">
                {callError}
              </p>
            )}
            <KeyboardSwipe
              enabled={phase === 'presenting' && !saving}
              onDecide={(y) => void decide(y)}
            />
          </>
        )}
      </section>
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

function Searching({
  step,
  steps,
  reduced,
}: {
  step: number;
  steps: number;
  reduced: boolean;
}) {
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
        {Array.from({ length: steps }, (_, i) => (
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
  onDecide: (add: boolean) => void;
  reduced: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const addStamp = useTransform(x, [-120, -30], [1, 0]);
  const skipStamp = useTransform(x, [30, 120], [0, 1]);

  const end = (_: unknown, info: PanInfo) => {
    const go =
      info.offset.x < -110 || info.velocity.x < -600 ? ADD : info.offset.x > 110 || info.velocity.x > 600 ? SKIP : 0;
    if (!go) {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 26 });
      return;
    }
    onDecide(go === ADD);
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
      variants={{
        exit: (d: number) =>
          reduced
            ? { opacity: 0 }
            : { x: d * 520, rotate: d * 18, opacity: 0, transition: { duration: 0.4, ease: EASE } },
      }}
      exit="exit"
      transition={{ duration: 0.3, ease: EASE }}
    >
      <CardView card={card} />
      {/* Stamps: ADD when dragging left (toward My list), SKIP when dragging right */}
      <motion.span
        style={{ opacity: addStamp }}
        className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-[12px] border-4 border-window px-3 py-1 text-[22px] font-extrabold text-window"
      >
        ADD
      </motion.span>
      <motion.span
        style={{ opacity: skipStamp }}
        className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-[12px] border-4 border-bad px-3 py-1 text-[22px] font-extrabold text-bad"
      >
        SKIP
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
      <div className="relative h-[180px] w-full shrink-0 bg-raised">
        <Image
          src={card.image}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 480px) 100vw, 480px"
          priority={!under}
        />
        <span className="absolute top-3 right-3 rounded-full bg-ink/70 px-2 py-0.5 text-[12px] font-bold text-chalk">
          Example
        </span>
      </div>
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
            <p className="mt-1 flex items-start gap-1 text-[12px] leading-4 text-text-3">
              <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
              {card.address}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[16px] leading-6 font-bold text-chalk">{card.pitch}</p>
        <p className="mt-1 text-[13px] leading-5 text-text-3">
          Rent &amp; deposit — Caller confirms on the phone (we don&apos;t guess).
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13px] leading-4 font-bold">
          <li className="flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5">
            {card.unitType}
          </li>
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

/** A little paper file that flies from Scout toward the team panel on every yes. */
function Toss({ active, reduced }: { active: boolean; reduced: boolean }) {
  if (!active || reduced) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute top-6 left-10 z-20 h-7 w-6 rounded-[4px] border border-line bg-white shadow"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: [0, -160, -380], y: [0, -90, 30], rotate: [0, -160, -340], opacity: [1, 1, 0] }}
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
      if (e.key === 'ArrowLeft') cb.current(true);
      if (e.key === 'ArrowRight') cb.current(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  return null;
}
