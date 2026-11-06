'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';

/** Avatar button with the signed-in user's initial, email and a sign-out action. */
export function UserMenu() {
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  if (me === null) {
    return (
      <Link
        href="/login"
        className="ml-auto rounded-full border border-line px-4 py-2 text-[13px] font-bold hover:bg-raised"
      >
        Sign in
      </Link>
    );
  }
  const initial = (me?.name ?? me?.email ?? '?').trim().charAt(0).toUpperCase();
  return (
    <div ref={box} className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account"
        className="grid size-11 place-items-center rounded-full"
      >
        <span className="grid size-9 place-items-center rounded-full bg-caller font-extrabold text-ink">
          {initial}
        </span>
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-50 w-64 rounded-[16px] border border-line bg-surface p-2 shadow-[var(--shadow-float)]">
          <div className="px-3 py-2">
            <p className="truncate font-bold">{me?.name ?? 'Student'}</p>
            <p className="truncate text-[13px] text-text-3">{me?.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-[12px] px-3 text-[14px] font-bold text-text-2 hover:bg-raised hover:text-chalk"
          >
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
