'use client';

import { useEffect, useId, useState } from 'react';
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect';
import { COUNTRIES } from '@/content/countries';
import { getGuestKey } from '@/lib/guestKey';
import {
  TRIP_STORAGE_KEY,
  readTripProfile,
  writeTripProfile,
  type TripProfile,
} from '@/lib/studentPacket';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({ value: c.code, label: c.name, keywords: c.code }));

/** Collect student details before the search — saved on device + synced to Convex. */
export function TripFields() {
  const id = useId();
  const sync = useMutation(api.packet.syncTripProfile);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [hasSSN, setHasSSN] = useState<boolean | null>(null);
  const [budgetMax, setBudgetMax] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only hydrate
    setToday(new Date().toISOString().slice(0, 10));
    const saved = readTripProfile();
    if (saved.name) setName(saved.name);
    if (saved.whatsapp) setWhatsapp(saved.whatsapp);
    if (saved.moveIn) setMoveIn(saved.moveIn);
    if (saved.country) setCountry(saved.country);
    if (saved.hasSSN === true || saved.hasSSN === false) setHasSSN(saved.hasSSN);
    if (saved.budgetMax != null) setBudgetMax(String(saved.budgetMax));
  }, []);

  const persist = (patch: TripProfile) => {
    writeTripProfile(patch);
    const next = { ...readTripProfile(), ...patch };
    const guestKey = getGuestKey();
    void sync({
      guestKey,
      name: next.name,
      whatsapp: next.whatsapp,
      homeCountry: next.country,
      arrivalDate: next.moveIn,
      hasSSN: next.hasSSN ?? null,
      budgetMax: next.budgetMax ?? null,
    }).catch(() => {
      /* offline / cold start — localStorage still holds it */
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2" htmlFor={`${id}-name`}>
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2">Your name</span>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="name"
          placeholder="As on your passport"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            persist({ name: e.target.value });
          }}
          className="h-12 w-full rounded-full border border-line bg-raised px-4 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
        />
      </label>

      <label className="grid gap-1" htmlFor={`${id}-wa`}>
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2">WhatsApp / phone</span>
        <input
          id={`${id}-wa`}
          type="tel"
          autoComplete="tel"
          placeholder="+1 …"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(e.target.value);
            persist({ whatsapp: e.target.value });
          }}
          className="h-12 w-full rounded-full border border-line bg-raised px-4 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
        />
      </label>

      <label className="grid gap-1" htmlFor={`${id}-date`}>
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2">Earliest move-in</span>
        <input
          id={`${id}-date`}
          type="date"
          min={today || undefined}
          value={moveIn}
          onChange={(e) => {
            setMoveIn(e.target.value);
            persist({ moveIn: e.target.value });
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
            persist({ country: v ?? undefined });
          }}
        />
      </div>

      <label className="grid gap-1" htmlFor={`${id}-budget`}>
        <span className="px-1 text-[12px] leading-4 font-bold text-text-2">Max rent / mo (USD)</span>
        <input
          id={`${id}-budget`}
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="e.g. 900"
          value={budgetMax}
          onChange={(e) => {
            setBudgetMax(e.target.value);
            const n = Number(e.target.value);
            persist({ budgetMax: Number.isFinite(n) && n > 0 ? n : null });
          }}
          className="h-12 w-full rounded-full border border-line bg-raised px-4 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
        />
      </label>

      <fieldset className="grid gap-1 sm:col-span-2">
        <legend className="px-1 text-[12px] leading-4 font-bold text-text-2">US Social Security number?</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { v: false, label: 'No SSN' },
              { v: true, label: 'I have an SSN' },
            ] as const
          ).map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => {
                setHasSSN(opt.v);
                persist({ hasSSN: opt.v });
              }}
              className={`min-h-11 rounded-full border px-4 text-[13px] font-bold transition ${
                hasSSN === opt.v
                  ? 'border-window bg-window-dim text-good'
                  : 'border-line bg-raised text-text-2 hover:border-chalk'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="sm:col-span-2 px-1 text-[12px] leading-4 text-text-3">
        Saved on this device as <span className="font-mono">{TRIP_STORAGE_KEY}</span>. You can upload passport /
        I-20 / funding docs in the app and email a private link to the leasing office.
      </p>
    </div>
  );
}
