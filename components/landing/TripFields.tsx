'use client';

import { useEffect, useId, useState } from 'react';
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect';
import { COUNTRIES } from '@/content/countries';

const KEY = 'hz.trip';
const OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({ value: c.code, label: c.name, keywords: c.code }));

/** Earliest move-in date and home country. Remembered on this device until sign-up saves them. */
export function TripFields() {
  const id = useId();
  const [moveIn, setMoveIn] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dates and saved values only exist in the browser
    setToday(new Date().toISOString().slice(0, 10));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { moveIn?: string; country?: string };
      if (saved.moveIn) setMoveIn(saved.moveIn);
      if (saved.country) setCountry(saved.country);
    } catch {}
  }, []);

  const save = (next: { moveIn?: string; country?: string | null }) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ moveIn, country, ...next }));
    } catch {}
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1" htmlFor={`${id}-date`}>
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2">Earliest move-in</span>
        <input
          id={`${id}-date`}
          type="date"
          min={today || undefined}
          value={moveIn}
          onChange={(e) => {
            setMoveIn(e.target.value);
            save({ moveIn: e.target.value });
          }}
          className={`h-12 w-full rounded-full border border-line bg-raised px-4 text-[15px] font-semibold outline-none focus:border-chalk ${moveIn ? 'text-chalk' : 'text-text-3'}`}
        />
      </label>
      <div className="grid gap-1">
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2" aria-hidden>
          Home country
        </span>
        <SearchSelect
          label="Home country"
          value={country}
          options={OPTIONS}
          placeholder="Choose country"
          searchPlaceholder="Search countries"
          onChange={(v) => {
            setCountry(v);
            save({ country: v });
          }}
        />
      </div>
    </div>
  );
}
