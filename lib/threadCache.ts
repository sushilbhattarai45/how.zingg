/**
 * Local backup of place chat threads so a refresh / tab close can restore instantly
 * even before Convex finishes loading (and if a sync briefly fails).
 */
import type { ChatMessage, PendingCallAsk } from '@/lib/conversation';
import { getGuestKey } from '@/lib/guestKey';

export type CachedThread = {
  messages: ChatMessage[];
  step: number;
  status: string;
  pendingAsk: PendingCallAsk | null;
  updatedAt: number;
};

function key(slug: string) {
  return `hz.thread.v1.${getGuestKey()}.${slug}`;
}

export function readThreadCache(slug: string): CachedThread | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedThread;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeThreadCache(slug: string, thread: Omit<CachedThread, 'updatedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedThread = { ...thread, updatedAt: Date.now() };
    localStorage.setItem(key(slug), JSON.stringify(payload));
  } catch {
    // Quota / private mode — Convex remains the source of truth.
  }
}

export function clearThreadCache(slug: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}

function fingerprint(m: ChatMessage): string {
  // Collapse near-duplicate bubbles (same speaker + same text) that got different ids.
  return `${m.from}::${(m.text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()}::${m.log ? `${m.log.kind}:${'outcome' in m.log ? m.log.outcome : ''}` : ''}`;
}

/** Merge message lists by id, then drop content-duplicates, sorted by time. */
export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const list of lists) {
    for (const m of list) {
      if (!m?.id) continue;
      const prev = byId.get(m.id);
      if (!prev || (m.text?.length ?? 0) >= (prev.text?.length ?? 0)) byId.set(m.id, m);
    }
  }
  const byFp = new Map<string, ChatMessage>();
  const sorted = [...byId.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const m of sorted) {
    const fp = fingerprint(m);
    const prev = byFp.get(fp);
    if (!prev) {
      byFp.set(fp, m);
      continue;
    }
    // Keep the earlier one; if the newer has an action the older lacks, prefer the richer copy.
    if (!prev.action && m.action) byFp.set(fp, { ...m, at: prev.at, id: prev.id });
  }
  return [...byFp.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
