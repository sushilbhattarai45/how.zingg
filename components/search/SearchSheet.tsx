'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { AgentDot } from '@/components/ui/AgentDot';
import { AGENT_COLOR } from '@/content/agents';

export const EXAMPLE_PROMPTS = [
  'Cheapest 1 bed under $700 near USM',
  'Nearest Walmart from campus',
  'Indian or Nepali groceries near USM',
  'Banks that open an account without an SSN',
  "Is Oak Hollow's 1 bed free on Aug 14?",
];

/**
 * "Ask the team". The live pipeline (plan → toss → steps → results → summary) is wired in M4;
 * this is the shell: input, university pill, example chips.
 */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const submit = (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setSubmitted(q);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ask the team"
      avatar={<AgentDot color={AGENT_COLOR.concierge} size={28} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex items-center gap-2 rounded-[16px] border border-line bg-raised p-1.5 pl-2"
      >
        <span className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-bold">USM</span>
        <label htmlFor="ask-input" className="sr-only">
          Ask anything about living near USM
        </label>
        <input
          id="ask-input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about living near USM…"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-text-3"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="grid size-11 place-items-center rounded-[12px] bg-window text-ink hover:bg-window-hi"
        >
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </form>

      {!submitted && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="min-h-11 rounded-full border border-line px-3 text-left text-[13px] font-bold text-text-2 hover:bg-raised hover:text-chalk"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {submitted && (
        <div className="mt-4 rounded-[16px] border border-line p-4" role="status">
          <p className="flex items-center gap-2 font-bold">
            <AgentDot color={AGENT_COLOR.concierge} /> Concierge
          </p>
          <p className="mt-1 text-text-2">
            Got it: &ldquo;{submitted}&rdquo;. The live search with Scout is being wired up in this build and
            isn&apos;t connected yet.
          </p>
        </div>
      )}
    </Sheet>
  );
}
