import type { Timers } from "../../src/sync/timers";

interface Scheduled {
  id: number;
  at: number;
  fn: () => void;
  every: number | null;
}

/**
 * A hand-cranked clock for tests: nothing fires until `advance(ms)` is called. Injected
 * into the server instead of faking global timers, which would also freeze the timers
 * inside the WebSocket and Yjs libraries.
 */
export class ManualTimers implements Timers {
  private clock = 0;
  private nextId = 1;
  private readonly scheduled = new Map<number, Scheduled>();

  setTimeout(fn: () => void, ms: number): number {
    return this.add(fn, ms, null);
  }

  setInterval(fn: () => void, ms: number): number {
    return this.add(fn, ms, ms);
  }

  now(): number {
    return this.clock;
  }

  clear(id: number): void {
    this.scheduled.delete(id);
  }

  /** Moves time forward, running everything that falls due, in order. */
  advance(ms: number): void {
    const end = this.clock + ms;
    for (;;) {
      const due = [...this.scheduled.values()]
        .filter((s) => s.at <= end)
        .sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.clock = due.at;
      if (due.every === null) this.scheduled.delete(due.id);
      else due.at += due.every;
      due.fn();
    }
    this.clock = end;
  }

  private add(fn: () => void, ms: number, every: number | null): number {
    const id = this.nextId++;
    this.scheduled.set(id, { id, at: this.clock + ms, fn, every });
    return id;
  }
}
