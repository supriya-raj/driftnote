import { CLOSE_RATE_LIMITED, CLOSE_TOO_LARGE } from "@driftnote/shared";

/** Abuse limits (ADR 011). Starting values; tuned in M5 against the performance target. */
export interface Limits {
  /** Largest a note may grow on the server. The real abuse limit. */
  readonly maxDocumentBytes: number;
  /**
   * Largest single message. Must be at least the document limit: a reconnect catch-up
   * (sync step 2) arrives as one message and can be as large as the whole note.
   */
  readonly maxMessageBytes: number;
  /** Sustained updates per second per connection (the bucket's refill rate). */
  readonly updatesPerSecond: number;
  /** Updates a connection may send in a burst (the bucket's size). */
  readonly updateBurst: number;
  /** Open sync connections allowed from one IP address. */
  readonly connectionsPerIp: number;
}

const MB = 1024 * 1024;

export const DEFAULT_LIMITS: Limits = {
  maxDocumentBytes: 20 * MB,
  maxMessageBytes: 24 * MB,
  updatesPerSecond: 60,
  updateBurst: 200,
  connectionsPerIp: 50,
};

/** Thrown while handling a message that breaks a limit; carries the close code to use. */
export class LimitError extends Error {
  constructor(
    readonly closeCode: typeof CLOSE_TOO_LARGE | typeof CLOSE_RATE_LIMITED,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Token bucket: holds up to `capacity` tokens, refills at `perSecond`; each update spends
 * one. Typing never empties it, a paste-sized burst is fine, a flood runs it dry.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    private readonly now: () => number,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
