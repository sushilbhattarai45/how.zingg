'use client';

import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { createWorldStore, type WorldState, type WorldStore } from './store';

const Ctx = createContext<WorldStore | null>(null);

/** Owns one world store. Wrap both the Canvas and any HTML that drives the world. */
export function WorldProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<WorldState>;
}) {
  const [store] = useState(() => createWorldStore(initial));
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useWorldStore(): WorldStore {
  const s = useContext(Ctx);
  if (!s) throw new Error('useWorldStore must be used inside <WorldProvider>');
  return s;
}

/** Subscribe a component to a slice of world state. */
export function useWorldState<T>(select: (s: WorldState) => T): T {
  const store = useWorldStore();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}
