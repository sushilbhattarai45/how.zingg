'use client';

import { useEffect, useState } from 'react';
import universities from '@/seed/universities.json';
import { SearchSelect, type SelectOption } from './SearchSelect';

const KEY = 'hz.university';
const DEFAULT = 'University of Southern Mississippi';

const OPTIONS: SelectOption[] = universities.map((u) => ({
  value: u.name,
  label: u.name,
  hint: `${u.city}, MS · ${u.ready ? 'Ready now' : 'Coming soon'}`,
  keywords: u.shortName,
}));

/** University pill: searchable list of schools, remembered on this device. */
export function UniversityPicker({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved choice after hydration
      if (saved && universities.some((u) => u.name === saved)) setValue(saved);
    } catch {}
  }, []);

  const known = universities.find((u) => u.name === value);

  return (
    <div className="flex flex-col gap-1">
      <SearchSelect
        label="University"
        value={value}
        options={OPTIONS}
        compact={compact}
        searchPlaceholder="Search schools in Mississippi"
        onChange={(v) => {
          setValue(v);
          try {
            localStorage.setItem(KEY, v);
          } catch {}
        }}
      />
      {known && !known.ready && (
        <p className="px-4 text-[13px] leading-[19px] text-wait">
          We&apos;re starting at USM. {known.shortName} is on the list; you can still look around.
        </p>
      )}
    </div>
  );
}
