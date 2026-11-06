'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Search, Mic } from 'lucide-react';
import { WorldProvider } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import type { FocusTarget } from '@/components/world/cameraRig';
import { UniversityPicker } from '@/components/ui/UniversityPicker';
import { SearchSheet } from '@/components/search/SearchSheet';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENTS } from '@/content/agents';

const World = dynamic(() => import('@/components/world/World').then((m) => m.World), { ssr: false });

const ROOMS: [FocusTarget, string][] = [
  ['all', 'Whole home'],
  ['office', 'Office'],
  ['hall', 'Hall'],
  ['kitchen', 'Kitchen'],
  ['living', 'Living room'],
  ['bedroom', 'Bedroom'],
  ['leasing', 'Leasing office'],
];

/** Student home (M7 builds this out: agent states, status line, activity, 3D picks). */
export function AppHome() {
  const world = useRef<WorldHandle | null>(null);
  const [focus, setFocus] = useState<FocusTarget>('all');
  const [askOpen, setAskOpen] = useState(false);
  return (
    <WorldProvider initial={{ mode: 'app' }}>
      <div className="flex h-dvh flex-col">
        <header className="flex items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="how.zingg home">
            <Image src="/brand/mark-dark.svg" alt="how.zingg" width={32} height={29} />
          </Link>
          <div className="max-w-xs flex-1">
            <UniversityPicker compact />
          </div>
          <span className="ml-auto grid size-9 place-items-center rounded-full bg-caller font-extrabold text-ink">
            A
          </span>
        </header>
        <nav aria-label="Rooms" className="flex gap-2 overflow-x-auto px-4 pb-2">
          {ROOMS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setFocus(id);
                world.current?.focus(id);
              }}
              aria-pressed={focus === id}
              className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold ${focus === id ? 'bg-chalk text-ink' : 'border border-line text-text-2'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="relative min-h-0 flex-1">
          <World
            mode="app"
            ref={(h) => {
              world.current = h;
              return h?.onPick((hit) => {
                if (hit.kind === 'leasing') setAskOpen(true);
              });
            }}
            className="absolute inset-0"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4">
            <ul
              className="flex justify-between gap-2 rounded-[16px] border border-line bg-surface/95 p-2"
              aria-label="Your team"
            >
              {AGENTS.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-1 flex-col items-center gap-1 text-[12px] font-bold text-text-2"
                >
                  <AgentDot color={a.color} size={20} />
                  {a.name}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setAskOpen(true)}
              className="flex h-[52px] items-center gap-3 rounded-[16px] border border-line bg-surface px-4 text-left text-text-3 shadow-[var(--shadow-float)]"
            >
              <Search size={20} aria-hidden />
              <span className="flex-1">Ask anything about living near USM…</span>
              <span className="grid size-9 place-items-center rounded-full bg-raised text-chalk">
                <Mic size={18} aria-hidden />
              </span>
            </button>
          </div>
        </main>
        <SearchSheet open={askOpen} onClose={() => setAskOpen(false)} />
      </div>
    </WorldProvider>
  );
}
