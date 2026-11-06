'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import universities from '@/seed/universities.json';

const KEY = 'hz.university';

/** Typeable university pill. Remembers the choice on this device. */
export function UniversityPicker({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [value, setValue] = useState('University of Southern Mississippi');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved choice after hydration
      if (saved) setValue(saved);
    } catch {}
  }, []);

  const known = universities.find((u) => u.name === value || u.shortName === value);
  const notReady = known && !known.ready;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        Which university?
      </label>
      <div
        className={`flex items-center gap-2 rounded-full border border-line bg-raised pr-3 pl-4 ${compact ? 'h-9' : 'h-12'}`}
      >
        <input
          id={id}
          list={`${id}-list`}
          value={value}
          placeholder="Which university?"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            try {
              localStorage.setItem(KEY, value);
            } catch {}
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-chalk outline-none placeholder:text-text-3"
        />
        <ChevronDown size={18} className="text-text-2" aria-hidden />
        <datalist id={`${id}-list`}>
          {universities.map((u) => (
            <option key={u.shortName} value={u.name} />
          ))}
        </datalist>
      </div>
      {notReady && (
        <p className="px-4 text-[13px] leading-[19px] text-wait">
          We&apos;re starting at USM. {known.shortName} is on the list; you can still look around.
        </p>
      )}
    </div>
  );
}
