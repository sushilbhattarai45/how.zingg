'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Mic, Phone, Search, Shrink, Sparkles } from 'lucide-react';
import { WorldProvider } from '@/components/world/WorldContext';
import type { WorldHandle } from '@/components/world/World';
import type { FocusTarget } from '@/components/world/cameraRig';
import type { BotId } from '@/components/world/store';
import { UniversityPicker } from '@/components/ui/UniversityPicker';
import { SearchSheet } from '@/components/search/SearchSheet';
import { StartCallSheet } from '@/components/calls/StartCallSheet';
import { AgentDot } from '@/components/ui/AgentDot';
import { buttonClass } from '@/components/ui/Button';
import { AGENTS } from '@/content/agents';
import { UserMenu } from '@/components/auth/UserMenu';

const World = dynamic(() => import('@/components/world/World').then((m) => m.World), { ssr: false });

/** Where each agent works, so tapping one flies the camera there (replaces the room chips). */
const ROOM_OF: Record<BotId, FocusTarget> = {
  concierge: 'living',
  scout: 'hall',
  caller: 'office',
  packet: 'kitchen',
  closer: 'hall',
};

/** One word of status under each agent (DESIGN.md: agent strip). Example data. */
const STATUS: Record<BotId, string> = {
  concierge: 'Planning',
  scout: 'Searching',
  caller: 'On a call',
  packet: '3 of 4',
  closer: 'Comparing',
};

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function AppHome() {
  const world = useRef<WorldHandle | null>(null);
  const [focus, setFocus] = useState<FocusTarget>('all');
  const [askOpen, setAskOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const go = (target: FocusTarget) => {
    setFocus(target);
    world.current?.focus(target);
  };

  return (
    <WorldProvider initial={{ mode: 'app' }}>
      <div className="relative h-dvh overflow-hidden">
        {/* The world fills the screen; UI floats on top */}
        <World
          mode="app"
          ref={(h) => {
            world.current = h;
            return h?.onPick((hit) => {
              if (hit.kind === 'leasing') setAskOpen(true);
              if (hit.kind === 'bot') go(ROOM_OF[hit.id]);
            });
          }}
          className="absolute inset-0"
        />

        <header className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-ink/90 to-transparent px-4 pt-3 pb-8">
          <Link href="/" aria-label="how.zingg home">
            <Image src="/brand/mark-dark.svg" alt="how.zingg" width={32} height={29} />
          </Link>
          <div className="max-w-xs flex-1">
            <UniversityPicker compact />
          </div>
          <UserMenu onCallNumber={() => setCallOpen(true)} />
        </header>

        <AnimatePresence>
          {focus !== 'all' && (
            <motion.button
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={() => go('all')}
              className="absolute top-[72px] left-1/2 flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-chalk px-4 text-[13px] font-bold text-ink shadow-[var(--shadow-float)]"
            >
              <Shrink size={15} aria-hidden /> Whole home
            </motion.button>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/80 to-transparent px-4 pt-10 pb-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {/* Agent strip: tap to fly to them and say hi */}
            <ul
              className="grid grid-cols-5 gap-1 rounded-[16px] border border-line bg-surface/95 p-1.5"
              aria-label="Your team"
            >
              {AGENTS.map((a) => (
                <li key={a.id} className="relative">
                  <button
                    onClick={() => {
                      go(ROOM_OF[a.id]);
                      world.current?.poke(a.id);
                    }}
                    aria-label={`${a.name}, ${STATUS[a.id]}. Say hi`}
                    className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[12px] hover:bg-raised"
                  >
                    <span className="relative">
                      <AgentDot color={a.color} size={18} />
                      <span
                        className="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-surface bg-window"
                        aria-hidden
                      />
                    </span>
                    <span className="text-[12px] leading-4 font-bold">{a.name}</span>
                    <span className="text-[11px] leading-3 text-text-3">{STATUS[a.id]}</span>
                  </button>
                  {a.id === 'caller' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCallOpen(true);
                      }}
                      aria-label="Call a number with Caller"
                      className="absolute -top-1 -right-1 grid size-8 place-items-center rounded-full bg-caller text-ink shadow-[var(--shadow-float)] hover:brightness-110"
                    >
                      <Phone size={14} strokeWidth={2.5} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/app/swipe"
                className={buttonClass('primary', 'min-h-[52px] rounded-[16px] sm:w-auto sm:px-6')}
              >
                <Sparkles size={18} aria-hidden /> Find my place
              </Link>
              <Link
                href="/app/places"
                className={buttonClass('secondary', 'min-h-[52px] rounded-[16px] sm:w-auto sm:px-6')}
              >
                <Heart size={18} aria-hidden /> My places
              </Link>
              <button
                onClick={() => setAskOpen(true)}
                className="flex h-[52px] flex-1 items-center gap-3 rounded-[16px] border border-line bg-surface px-4 text-left text-text-3 shadow-[var(--shadow-float)] hover:text-text-2"
              >
                <Search size={20} aria-hidden />
                <span className="flex-1 truncate">Ask anything about living near USM…</span>
                <span className="grid size-9 place-items-center rounded-full bg-raised text-chalk">
                  <Mic size={18} aria-hidden />
                </span>
              </button>
            </div>
          </div>
        </div>

        <SearchSheet open={askOpen} onClose={() => setAskOpen(false)} />
        <StartCallSheet open={callOpen} onClose={() => setCallOpen(false)} />
      </div>
    </WorldProvider>
  );
}
