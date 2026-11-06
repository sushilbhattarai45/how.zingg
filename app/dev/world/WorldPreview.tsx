'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { WorldProvider } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import type { FocusTarget } from '@/components/world/cameraRig';
import { WINDOW_TARGETS } from '@/components/world/store';

const World = dynamic(() => import('@/components/world/World').then((m) => m.World), { ssr: false });

const FOCI: FocusTarget[] = ['all', 'office', 'hall', 'kitchen', 'living', 'bedroom', 'leasing'];

/** Dev-only page to look at the world in isolation. */
export function WorldPreview() {
  const world = useRef<WorldHandle>(null);
  const [lit, setLit] = useState(false);
  const [last, setLast] = useState('');
  return (
    <WorldProvider initial={{ mode: 'app' }}>
      <main className="relative h-dvh w-full">
        <World
          mode="app"
          ref={(h) => {
            world.current = h;
            h?.onPick((hit) => setLast(JSON.stringify(hit)));
          }}
          className="absolute inset-0"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {FOCI.map((f) => (
            <button
              key={f}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold"
              onClick={() => world.current?.focus(f)}
            >
              {f}
            </button>
          ))}
          <button
            className="rounded-full bg-window px-3 py-1.5 text-sm font-bold text-ink"
            onClick={() => {
              const next = !lit;
              setLit(next);
              WINDOW_TARGETS.forEach((t, i) => setTimeout(() => world.current?.lightWindow(t, next), i * 80));
            }}
          >
            {lit ? 'Lights off' : 'Lights on'}
          </button>
        </div>
        {last && (
          <p className="absolute bottom-3 left-3 rounded-xl bg-surface px-3 py-2 text-sm">Picked {last}</p>
        )}
      </main>
    </WorldProvider>
  );
}
