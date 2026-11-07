'use client';

import { ButtonLink } from '@/components/ui/Button';
import { UniversityPicker } from '@/components/ui/UniversityPicker';
import { TripFields } from './TripFields';

export function HeroCard() {
  return (
    <div>
      <h1 className="text-[34px] leading-[38px] font-extrabold md:text-[46px] md:leading-[50px]">
        Find a home near campus before you land.
      </h1>
      <p className="mt-3 text-[17px] leading-[25px] text-text-2">
        how.zingg&apos;s AI team calls leasing offices, checks the neighborhood and handles the paperwork
        while you sleep.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        <UniversityPicker />
        <TripFields />
      </div>
      <div className="mt-4">
        <ButtonLink href="/app">Start my search</ButtonLink>
      </div>
      <p className="mt-4 text-[13px] leading-[19px] text-text-3">
        No SSN needed · Free for students · You approve every step
      </p>
    </div>
  );
}
