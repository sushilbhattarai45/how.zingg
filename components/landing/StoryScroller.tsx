'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react';
import { WorldProvider, useWorldStore } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import { WINDOW_TARGETS, type SceneName, type WindowTarget } from '@/components/world/store';
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

const APARTMENT: WindowTarget[] = ['office', 'hall', 'kitchen', 'living', 'bedroom'];

/** Which windows are lit at scroll progress p. */
export function windowsAt(p: number): Record<WindowTarget, boolean> {
  const out = Object.fromEntries(WINDOW_TARGETS.map((t) => [t, false])) as Record<WindowTarget, boolean>;
  const [ws, we] = BEATS['to-work'];
  if (p < BEATS.team[0]) APARTMENT.forEach((t) => (out[t] = true));
  else if (p < ws) out.leasing = true;
  else if (p < we) {
    // Rooms light up one by one as each bot arrives.
    const k = (p - ws) / (we - ws);
    APARTMENT.forEach((t, i) => (out[t] = k > 0.25 + i * 0.13));
  } else APARTMENT.forEach((t) => (out[t] = true));
  if (p >= BEATS.booked[0]) out.leasing = true;
  return out;
}

function beatAt(p: number): BeatId {
  let id: BeatId = 'hero';
  for (const [k, [s]] of Object.entries(BEATS) as [BeatId, readonly [number, number]][]) if (p >= s) id = k;
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
  const world = useRef<WorldHandle | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [roommatesOpen, setRoommatesOpen] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const timers = useRef<number[]>([]);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  const apply = useCallback(
    (p: number) => {
      const beat = beatAt(p);
      store.set({
        scrollProgress: p,
        scene: SCENE_FOR[beat],
        officeGlow: beat === 'ask' || beat === 'team',
        doorLight: beat === 'booked',
      });
      // Stagger window changes 80 ms apart (the "lights on" motion).
      const want = windowsAt(p);
      const { windows, reducedMotion } = store.get();
      const changes = WINDOW_TARGETS.filter((t) => windows[t] !== want[t]);
      timers.current.forEach(clearTimeout);
      timers.current = changes.map((t, i) =>
        window.setTimeout(() => store.setWindow(t, want[t]), reducedMotion ? 0 : i * 80),
      );
    },
    [store],
  );

  useMotionValueEvent(scrollYProgress, 'change', apply);

  useEffect(() => {
    // First paint: windows light up one by one once the world is in.
    if (!worldReady) return;
    const id = window.setTimeout(() => apply(scrollYProgress.get()), 300);
    return () => clearTimeout(id);
  }, [worldReady, apply, scrollYProgress]);

  // Clicking the leasing office in 3D opens the search tool.
  const attachWorld = useCallback((h: WorldHandle | null) => {
    world.current = h;
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
      {/* Sticky world behind the panels */}
      <div className="sticky top-0 z-0 h-[58svh] w-full overflow-hidden bg-[#2a2630] md:h-svh">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: worldReady ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <World mode="landing" ref={attachWorld} className="absolute inset-0" />
        </motion.div>
        <OfficeLabel progress={scrollYProgress} onOpen={() => setSearchOpen(true)} />
      </div>

      {/* Beat panels scroll over the world */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <Beat id="hero" progress={scrollYProgress} first>
          <HeroBeat
            onMeet={() => scrollToProgress(BEATS.team[0] + 0.02)}
            onHow={() => scrollToProgress(BEATS.rooms[0] + 0.01)}
          />
        </Beat>
        <Beat id="problem" progress={scrollYProgress}>
          <ProblemBeat />
        </Beat>
        <Beat id="team" progress={scrollYProgress}>
          <TeamBeat />
        </Beat>
        <Beat id="ask" progress={scrollYProgress}>
          <AskBeat onAsk={() => setSearchOpen(true)} />
        </Beat>
        <Beat id="to-work" progress={scrollYProgress}>
          <ToWorkBeat />
        </Beat>
        <SubBeat range={[0.64, 0.7]} progress={scrollYProgress}>
          <RoomBeat room="office" />
        </SubBeat>
        <SubBeat range={[0.7, 0.76]} progress={scrollYProgress}>
          <RoomBeat room="hall" />
        </SubBeat>
        <SubBeat range={[0.76, 0.82]} progress={scrollYProgress}>
          <RoomBeat room="kitchen" />
        </SubBeat>
        <Beat id="couch" progress={scrollYProgress}>
          <CouchBeat onOpen={() => setRoommatesOpen(true)} />
        </Beat>
        <Beat id="booked" progress={scrollYProgress} last>
          <BookedBeat />
        </Beat>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <RoommatesPreview open={roommatesOpen} onClose={() => setRoommatesOpen(false)} />
    </section>
  );
}

function Beat({
  id,
  ...rest
}: {
  id: BeatId;
  progress: MotionValue<number>;
  children: React.ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return <SubBeat range={BEATS[id]} {...rest} />;
}

/** A panel that is sticky while its range scrolls by, fading in/out over 20% of the range. */
function SubBeat({
  range: [start, end],
  progress,
  children,
  first,
  last,
}: {
  range: readonly [number, number];
  progress: MotionValue<number>;
  children: React.ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  const len = end - start;
  const opacity = useTransform(
    progress,
    [start, start + len * 0.2, end - len * 0.2, end],
    [first ? 1 : 0, 1, 1, last ? 1 : 0],
  );
  const y = useTransform(progress, [start, start + len * 0.2], [first ? 0 : 24, 0]);
  return (
    <div
      className="absolute inset-x-0 pt-[calc(58svh+12px)] md:pt-0"
      style={{ top: `${start * 100}%`, height: `${len * 100}%` }}
    >
      {/* Mobile: the card sits below the 58svh world and scrolls with the page. Desktop: sticky on the left. */}
      <motion.div
        style={{ opacity, y }}
        className="pointer-events-auto relative mx-4 max-w-[440px] rounded-[20px] border border-line bg-surface/[.88] p-6 backdrop-blur-sm md:sticky md:top-[max(96px,calc(50svh-220px))] md:ml-[6vw]"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Floating "Tap to ask the team" label over the office door during the Ask beat (HTML, so it's focusable). */
function OfficeLabel({ progress, onOpen }: { progress: MotionValue<number>; onOpen: () => void }) {
  const [s, e] = BEATS.ask;
  const opacity = useTransform(progress, [s - 0.02, s + 0.02, e - 0.02, e], [0, 1, 1, 0]);
  const [visible, setVisible] = useState(false);
  useMotionValueEvent(opacity, 'change', (v) => setVisible(v > 0.05));
  return (
    <motion.button
      style={{ opacity }}
      onClick={onOpen}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`absolute top-[30%] left-1/2 min-h-14 -translate-x-1/2 rounded-full bg-chalk px-5 text-[15px] font-bold text-ink shadow-[var(--shadow-float)] md:top-[34%] md:left-[62%] ${visible ? '' : 'pointer-events-none'}`}
    >
      <span className="mr-2 inline-block size-2.5 rounded-full bg-window align-middle" aria-hidden />
      Tap to ask the team
    </motion.button>
  );
}
