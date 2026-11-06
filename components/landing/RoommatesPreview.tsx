'use client';

import { Sheet } from '@/components/ui/Sheet';
import roommates from '@/seed/roommates.json';

function monthDay(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function RoommatesPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="On the couch" width={520}>
      <p className="text-[13px] leading-[19px] text-text-3">People on the couch · Example data</p>
      <ul className="mt-3 flex flex-col gap-2">
        {roommates.map((r) => (
          <li key={r.name} className="rounded-[16px] border border-line p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-raised font-extrabold">
                {r.name[0]}
              </span>
              <div className="flex-1">
                <p className="font-bold">
                  {r.name}{' '}
                  <span className="ml-1 rounded-full bg-raised px-2 py-0.5 text-[12px] text-text-3">
                    Example
                  </span>
                </p>
                <p className="text-[13px] leading-[19px] text-text-2">{r.program}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-bold">
              <span className="tabular rounded-full bg-raised px-2 py-1">
                ${r.budgetMin}–{r.budgetMax}
              </span>
              <span className="rounded-full bg-raised px-2 py-1">{monthDay(r.moveIn)}</span>
              {r.tags.map((t) => (
                <span key={t} className="rounded-full bg-raised px-2 py-1">
                  {t}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-[19px] text-text-3">
        Matches use only the lifestyle fields people choose to share.
      </p>
    </Sheet>
  );
}
