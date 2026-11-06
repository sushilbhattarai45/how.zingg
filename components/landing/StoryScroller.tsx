'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { WorldProvider, useWorldStore } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import { WINDOW_TARGETS, type BotId, type SceneName, type WindowTarget } from '@/components/world/store';
import { BEATS, STORY_HEIGHT_VH, type BeatId } from '@/content/beats';
import {
  HeroBeat,
  ProblemBeat,
  TeamBeat,
  AskBeat,
  ToWorkBeat,
  RoomBeat,
  CouchBeat,
  BookedBeat,
} from './beats';
import { SearchSheet } from '@/components/search/SearchSheet';
import { RoommatesPreview } from './RoommatesPreview';

const World = dynamic(() => import('@/components/world/World').then((m) => m.World), {
  ssr: false,
  loading: () => null,
});

const SCENE_FOR: Record<BeatId, SceneName> = {
  hero: 'hero',
  problem: 'hero',
  team: 'office-lineup',
  ask: 'office-lineup',
  'to-work': 'walk-to-apartment',
  rooms: 'rooms-tour',
  couch: 'couch',
  booked: 'booked',
};

/** The story's steps: what the card shows and what the progress rail marks. */
type StepId = Exclude<BeatId, 'rooms'> | 'room-office' | 'room-hall' | 'room-kitchen';
const STEPS: { id: StepId; label: string; at: number }[] = [
  { id: 'hero', label: 'Start', at: BEATS.hero[0] },
  { id: 'problem', label: 'The problem', at: BEATS.problem[0] },
  { id: 'team', label: 'Meet the team', at: BEATS.team[0] },
  { id: 'ask', label: 'Ask', at: BEATS.ask[0] },
  { id: 'to-work', label: 'They get to work', at: BEATS['to-work'][0] },
  { id: 'room-office', label: 'Caller', at: 0.64 },
  { id: 'room-hall', label: 'Scout', at: 0.7 },
  { id: 'room-kitchen', label: 'Packet', at: 0.76 },
  { id: 'couch', label: 'Roommates', at: BEATS.couch[0] },
  { id: 'booked', label: 'Booked', at: BEATS.booked[0] },
];

/**
 * The world follows scroll at a capped speed (progress per second), so a fast scroll never rushes
 * the camera or the bots: they finish each move smoothly and catch up.
 */
const MAX_RATE = 0.075;
const FOLLOW = 3.2;

const APARTMENT: WindowTarget[] = ['office', 'hall', 'kitchen', 'living', 'bedroom'];

/** Which windows are lit at scroll progress p. */
export function windowsAt(p: number): Record<WindowTarget, boolean> {
  const out = Object.fromEntries(WINDOW_TARGETS.map((t) => [t, false])) as Record<WindowTarget, boolean>;
  const [ws, we] = BEATS['to-work'];
  if (p < ws) out.leasing = p >= BEATS.team[0];
  else if (p < we) {
    // Rooms light up one by one as each bot arrives.
    const k = (p - ws) / (we - ws);
    APARTMENT.forEach((t, i) => (out[t] = k > 0.45 + i * 0.1));
  } else APARTMENT.forEach((t) => (out[t] = true));
  if (p >= BEATS.booked[0]) out.leasing = true;
  return out;
}

function beatAt(p: number): BeatId {
  let id: BeatId = 'hero';
  for (const [k, [s]] of Object.entries(BEATS) as [BeatId, readonly [number, number]][]) if (p >= s) id = k;
  return id;
}

function stepAt(p: number): StepId {
  let id: StepId = 'hero';
  for (const s of STEPS) if (p >= s.at - 1e-6) id = s.id;
  return id;
}

export function StoryScroller() {
  return (
    <WorldProvider initial={{ mode: 'landing', scene: 'hero' }}>
      <Story />
    </WorldProvider>
  );
}

function Story() {
  const store = useWorldStore();
  const section = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [roommatesOpen, setRoommatesOpen] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [step, setStep] = useState<StepId>('hero');
  const smooth = useMotionValue(0);
  const timers = useRef<number[]>([]);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  /** Everything that depends on where the story is: scene, glows, windows, card. */
  const apply = useCallback(
    (p: number) => {
      const beat = beatAt(p);
      const { scene, officeGlow, doorLight } = store.get();
      const next = {
        scrollProgress: p,
        scene: SCENE_FOR[beat],
        officeGlow: beat === 'ask' || beat === 'team',
        doorLight: beat === 'booked',
      };
      if (next.scene !== scene || next.officeGlow !== officeGlow || next.doorLight !== doorLight)
        store.set(next);
      else store.get().scrollProgress = p; // per-frame value: no listeners needed

      // Stagger window changes 80 ms apart (the "lights on" motion).
      const want = windowsAt(p);
      const { windows, reducedMotion } = store.get();
      const changes = WINDOW_TARGETS.filter((t) => windows[t] !== want[t]);
      if (changes.length) {
        timers.current.forEach(clearTimeout);
        timers.current = changes.map((t, i) =>
          window.setTimeout(() => store.setWindow(t, want[t]), reducedMotion ? 0 : i * 80),
        );
      }
      smooth.set(p);
      setStep(stepAt(p));
    },
    [store, smooth],
  );

  // Follow the scroll position at a capped, eased speed.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let cur = -1;
    const tick = (now: number) => {
      if (cur < 0) {
        cur = scrollYProgress.get();
        apply(cur);
      }
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const target = scrollYProgress.get();
      const diff = target - cur;
      if (Math.abs(diff) > 1e-4) {
        const reduced = store.get().reducedMotion;
        const step = reduced
          ? diff
          : Math.sign(diff) * Math.min(Math.abs(diff) * (1 - Math.exp(-dt * FOLLOW)), MAX_RATE * dt);
        cur += step;
        apply(cur);
      } else if (cur !== target) {
        cur = target;
        apply(cur);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [apply, scrollYProgress, store]);

  // Clicking the leasing office or the couch in 3D opens the matching sheet.
  const attachWorld = useCallback((h: WorldHandle | null) => {
    if (!h) return;
    setWorldReady(true);
    return h.onPick((hit) => {
      if (hit.kind === 'leasing') setSearchOpen(true);
      if (hit.kind === 'couch') setRoommatesOpen(true);
    });
  }, []);

  const scrollToProgress = (p: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.offsetTop + p * (el.offsetHeight - window.innerHeight);
    window.scrollTo({ top, behavior: store.get().reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <section ref={section} id="how" className="relative" style={{ height: `${STORY_HEIGHT_VH}vh` }}>
      <div className="sticky top-0 z-0 h-svh w-full overflow-hidden bg-[#2a2630]">
        {/* World: top 58% on mobile, full screen on desktop */}
        <div className="absolute inset-x-0 top-0 h-[58svh] md:h-full">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: worldReady ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          >
            <World mode="landing" ref={attachWorld} className="absolute inset-0" />
          </motion.div>
          <AnimatePresence>
            {step === 'ask' && (
              <motion.button
                key="office-label"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                onClick={() => setSearchOpen(true)}
                className="absolute top-[24%] left-1/2 min-h-14 -translate-x-1/2 rounded-full bg-chalk px-5 text-[15px] font-bold text-ink shadow-[var(--shadow-float)] md:top-[30%] md:left-[64%]"
              >
                <span
                  className="mr-2 inline-block size-2.5 rounded-full bg-window align-middle"
                  aria-hidden
                />
                Tap to ask the team
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Story card: one fixed-width card, pinned; content cross-fades between steps */}
        <div className="absolute inset-x-0 top-[58svh] bottom-0 flex flex-col px-4 pt-3 pb-4 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-[max(16px,4vw)] md:-translate-y-1/2 md:flex-row md:items-center md:gap-5 md:p-0">
          <ProgressRail progress={smooth} current={step} onJump={(p) => scrollToProgress(p + 0.005)} />
          <StoryCard step={step}>
            <StepContent
              step={step}
              onMeet={() => scrollToProgress(BEATS.team[0] + 0.02)}
              onHow={() => scrollToProgress(BEATS.rooms[0] + 0.01)}
              onAsk={() => setSearchOpen(true)}
              onRoommates={() => setRoommatesOpen(true)}
              onPoke={(id) => store.poke(id)}
            />
          </StoryCard>
        </div>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <RoommatesPreview open={roommatesOpen} onClose={() => setRoommatesOpen(false)} />
    </section>
  );
}

function StepContent({
  step,
  onMeet,
  onHow,
  onAsk,
  onRoommates,
  onPoke,
}: {
  step: StepId;
  onPoke: (id: BotId) => void;
  onMeet: () => void;
  onHow: () => void;
  onAsk: () => void;
  onRoommates: () => void;
}) {
  switch (step) {
    case 'hero':
      return <HeroBeat onMeet={onMeet} onHow={onHow} />;
    case 'problem':
      return <ProblemBeat />;
    case 'team':
      return <TeamBeat onPoke={onPoke} />;
    case 'ask':
      return <AskBeat onAsk={onAsk} />;
    case 'to-work':
      return <ToWorkBeat />;
    case 'room-office':
      return <RoomBeat room="office" />;
    case 'room-hall':
      return <RoomBeat room="hall" />;
    case 'room-kitchen':
      return <RoomBeat room="kitchen" />;
    case 'couch':
      return <CouchBeat onOpen={onRoommates} />;
    case 'booked':
      return <BookedBeat />;
  }
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Fixed-size card: it never changes size. Content cross-fades between steps; transitions always
 * run to completion, and a fast scroll just queues the latest step. Solid background (no backdrop
 * blur) so the 3D canvas behind it isn't re-blurred every frame.
 */
function StoryCard({ step, children }: { step: StepId; children: React.ReactNode }) {
  return (
    <div className="theme-light pointer-events-auto relative min-h-0 w-full overflow-hidden rounded-[20px] bg-paper shadow-[0_12px_40px_rgba(17,16,18,.35)] max-md:flex-1 md:h-[min(560px,calc(100svh-150px))] md:w-[440px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="absolute inset-0 overflow-y-auto p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.2, ease: 'easeIn' } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Where you are in the story: a thin line that fills as you scroll, with a dot per step. */
function ProgressRail({
  progress,
  current,
  onJump,
}: {
  progress: MotionValue<number>;
  current: StepId;
  onJump: (p: number) => void;
}) {
  const fill = useTransform(progress, [0, 1], ['0%', '100%']);
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <nav
      aria-label="Story progress"
      className="relative shrink-0 max-md:mb-3 max-md:h-6 md:h-[min(520px,calc(100svh-190px))] md:w-6"
    >
      {/* Track and fill: horizontal on mobile, vertical on desktop */}
      <div className="absolute rounded-full bg-white/20 max-md:inset-x-0 max-md:top-1/2 max-md:h-[3px] max-md:-translate-y-1/2 md:inset-y-0 md:left-1/2 md:w-[3px] md:-translate-x-1/2" />
      <motion.div
        className="absolute rounded-full bg-window max-md:top-1/2 max-md:left-0 max-md:hidden max-md:h-[3px] md:top-0 md:left-1/2 md:w-[3px] md:-translate-x-1/2"
        style={{ height: fill }}
      />
      <motion.div
        className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-window md:hidden"
        style={{ width: fill }}
      />
      {STEPS.map((s, i) => {
        const reached = i <= currentIdx;
        const active = s.id === current;
        return (
          <button
            key={s.id}
            onClick={() => onJump(s.at)}
            aria-label={s.label}
            aria-current={active ? 'step' : undefined}
            className="group absolute grid size-6 place-items-center max-md:top-0 max-md:left-[var(--pos)] max-md:-translate-x-1/2 md:top-[var(--pos)] md:left-0 md:-translate-y-1/2"
            style={{ ['--pos' as string]: `${s.at * 100}%` }}
          >
            <span
              className={`block rounded-full transition-all duration-300 ${active ? 'size-3.5 bg-window ring-4 ring-window/25' : reached ? 'size-2.5 bg-window' : 'size-2.5 bg-white/40'}`}
            />
            <span className="pointer-events-none absolute left-8 rounded-full bg-chalk px-2 py-0.5 text-[12px] leading-4 font-bold whitespace-nowrap text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:hidden">
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
