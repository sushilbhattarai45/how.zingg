'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Bottom sheet on mobile, centered panel on desktop. Built on <dialog>: focus is trapped,
 * Esc closes, and focus returns to the trigger. Page scroll is locked while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  avatar,
  children,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  avatar?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const y = window.scrollY;
      d.showModal();
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = '';
        window.scrollTo({ top: y });
      };
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className="sheet m-0 mt-auto max-h-[88vh] w-full max-w-none rounded-t-[20px] border border-line bg-surface p-0 text-chalk shadow-[var(--shadow-float)] backdrop:bg-black/60 md:m-auto md:max-h-[80vh] md:rounded-[20px]"
      style={{ ['--sheet-w' as string]: `${width}px` }}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col md:max-h-[80vh]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <header className="flex items-center gap-3 px-4 pt-3 pb-2">
            {avatar}
            <h2 className="flex-1 text-[18px] leading-6 font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="grid size-11 place-items-center rounded-full text-text-2 hover:bg-raised hover:text-chalk"
              aria-label="Close"
            >
              <X size={22} strokeWidth={2} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
