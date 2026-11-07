'use client';

/**
 * Pill button that opens a searchable list. The list always shows every option (filtered only by
 * what you type in its search box). Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type SelectOption = { value: string; label: string; hint?: string; keywords?: string };

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  searchPlaceholder = 'Search',
  compact = false,
}: {
  /** Accessible name, e.g. "University". */
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q));
  }, [query, options]);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);

  const openList = () => {
    setQuery('');
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  };

  const choose = (o: SelectOption) => {
    onChange(o.value);
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = list[active];
      if (o) choose(o);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? 'not set'}. Change`}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`flex w-full items-center gap-2 rounded-full border border-line bg-raised pr-3 pl-4 text-left ${compact ? 'h-9' : 'h-12'}`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${current ? 'text-chalk' : 'text-text-3'}`}
        >
          {current?.label ?? placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-text-2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 min-w-[260px] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--shadow-float)]">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={16} className="shrink-0 text-text-3" aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              aria-label={`Search ${label.toLowerCase()}`}
              aria-controls={`${id}-list`}
              aria-activedescendant={list[active] ? `${id}-opt-${active}` : undefined}
              className="h-11 min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-chalk outline-none placeholder:text-text-3"
            />
          </div>
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
            {list.length === 0 && <li className="px-3 py-3 text-[14px] text-text-3">No match yet.</li>}
            {list.map((o, i) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 ${i === active ? 'bg-raised' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] leading-5 font-bold text-chalk">
                      {o.label}
                    </span>
                    {o.hint && <span className="block text-[12px] leading-4 text-text-3">{o.hint}</span>}
                  </span>
                  {selected && <Check size={16} className="shrink-0 text-window" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
