/**
 * The timer functions the sync server uses, injected so tests can drive time by hand
 * (test/support/manualTimers.ts) instead of faking global timers.
 */
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  setInterval(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clear: (handle) => {
    clearTimeout(handle as NodeJS.Timeout);
  },
};
