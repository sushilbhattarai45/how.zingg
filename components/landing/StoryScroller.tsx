'use client';

/**
 * Landing hero: one screen. The 3D world (campus, apartment building, leasing office, the team)
 * plays a short show by itself: the team hangs out on the block, walks into the apartment while
 * the roof lifts off, works, then waves goodbye. No scroll-driven story.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { WorldProvider, useWorldStore } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import { WINDOW_TARGETS, type WindowTarget } from '@/components/world/store';
import { SHOW, SHOW_SECONDS, showPartAt } from '@/content/beats';
import { HeroCard } from './beats';
import { SearchSheet } from '@/components/search/SearchSheet';
import { RoommatesPreview } from './RoommatesPreview';

const World = dynamic(() => import('@/components/world/World').then((m) => m.World), {
  ssr: false,
  loading: () => null,
});

const APARTMENT: WindowTarget[] = ['office', 'hall', 'kitchen', 'living', 'bedroom'];

/** Which windows are lit at show progress p. */
export function windowsAt(p: number): Record<WindowTarget, boolean> {
  const out = Object.fromEntries(WINDOW_TARGETS.map((t) => [t, false])) as Record<WindowTarget, boolean>;
  const [ws, we] = SHOW.walk;
  if (p >= ws && p < we) {
    // Rooms light up one by one as each bot arrives.
    const k = (p - ws) / (we - ws);
    APARTMENT.forEach((t, i) => (out[t] = k > 0.45 + i * 0.1));
  } else if (p >= we) APARTMENT.forEach((t) => (out[t] = true));
  if (p >= SHOW.bye[0]) out.leasing = true;
  return out;
}

export function StoryScroller() {
  return (
    <WorldProvider initial={{ mode: 'landing', scene: 'hero' }}>
      <Hero />
    </WorldProvider>
  );
}

function Hero() {
  const store = useWorldStore();
  const [worldReady, setWorldReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [roommatesOpen, setRoommatesOpen] = useState(false);
  const progress = useRef(0);
  const timers = useRef<number[]>([]);

  const apply = useCallback(
    (p: number) => {
      const doorLight = showPartAt(p) === 'bye';
      store.get().scrollProgress = p; // read per frame by the directors and camera
      if (store.get().doorLight !== doorLight) store.set({ doorLight });
      const want = windowsAt(p);
      const { windows, reducedMotion } = store.get();
      const changes = WINDOW_TARGETS.filter((t) => windows[t] !== want[t]);
      if (changes.length) {
        timers.current.forEach(clearTimeout);
        timers.current = changes.map((t, i) =>
          window.setTimeout(() => store.setWindow(t, want[t]), reducedMotion ? 0 : i * 80),
        );
      }
    },
    [store],
  );

  // Play the show once the world is in. Reduced motion: show the team at work, no animation.
  useEffect(() => {
    if (!worldReady) return;
    if (store.get().reducedMotion) {
      progress.current = (SHOW.work[0] + SHOW.work[1]) / 2;
      apply(progress.current);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      progress.current = Math.min(1, progress.current + dt / SHOW_SECONDS);
      apply(progress.current);
      if (progress.current >= 1) return; // ends with the team at work
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [worldReady, apply, store]);

  const attachWorld = useCallback((h: WorldHandle | null) => {
    if (!h) return;
    setWorldReady(true);
    return h.onPick((hit) => {
      if (hit.kind === 'leasing') setSearchOpen(true);
      if (hit.kind === 'couch') setRoommatesOpen(true);
    });
  }, []);

  return (
    <section id="how" className="relative h-svh min-h-[640px] w-full overflow-hidden bg-[#2a2630]">
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
      </div>

      {/* Hero card */}
      <div className="absolute inset-x-0 top-[58svh] bottom-0 px-4 pt-3 pb-4 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-[max(16px,5vw)] md:-translate-y-1/2 md:p-0">
        <div className="theme-light h-full overflow-y-auto md:overflow-visible rounded-[20px] bg-paper p-6 shadow-[0_12px_40px_rgba(17,16,18,.35)] md:h-auto md:w-[440px]">
          <HeroCard />
        </div>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <RoommatesPreview open={roommatesOpen} onClose={() => setRoommatesOpen(false)} />
    </section>
  );
}
