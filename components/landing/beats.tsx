'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { UniversityPicker } from '@/components/ui/UniversityPicker';

export function HeroCard({
  playing,
  ended,
  onToggle,
  onReplay,
}: {
  playing: boolean;
  ended: boolean;
  onToggle: () => void;
  onReplay: () => void;
}) {
  return (
    <div>
      <p className="mb-3 inline-flex rounded-full bg-window-dim px-3 py-1 text-[12px] leading-4 font-bold text-good">
        For international + transfer students
      </p>
      <h1 className="text-[34px] leading-[38px] font-extrabold md:text-[46px] md:leading-[50px]">
        Find a home near campus before you land.
      </h1>
      <p className="mt-3 text-[17px] leading-[25px] text-text-2">
        how.zingg&apos;s AI team calls leasing offices, checks the neighborhood and handles the paperwork
        while you sleep.
      </p>
      <div className="mt-5">
        <UniversityPicker />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/app">Start my search</ButtonLink>
        {ended ? (
          <Button variant="secondary" onClick={onReplay}>
            <RotateCcw size={16} aria-hidden /> Watch again
          </Button>
        ) : (
          <Button variant="secondary" onClick={onToggle} aria-pressed={!playing}>
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </Button>
        )}
      </div>
      <p className="mt-4 text-[13px] leading-[19px] text-text-3">
        No SSN needed · Free for students · You approve every step
      </p>
    </div>
  );
}
