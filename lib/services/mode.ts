import { isDemoMode } from '../clock';

/**
 * Wrap a real service so any thrown error falls back to the mock (with a warning).
 * In DEMO_MODE, or when the real service isn't configured, the mock is used directly.
 */
export function withFallback<T extends object>(name: string, real: T | null, mock: T): T {
  if (isDemoMode() || !real) return mock;
  return new Proxy(real, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (err) {
          console.warn(`[services/${name}] real.${String(prop)} failed, using mock:`, err);
          const fallback = Reflect.get(mock, prop) as (...a: unknown[]) => unknown;
          return fallback.apply(mock, args);
        }
      };
    },
  });
}

export function envOrNull(name: string): string | null {
  const v = typeof process !== 'undefined' ? process.env[name] : undefined;
  return v && v.trim() ? v.trim() : null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
