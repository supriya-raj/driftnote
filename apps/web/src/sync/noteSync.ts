import {
  ackCovers,
  CLOSE_INVALID_TOKEN,
  CLOSE_NOTE_DELETED,
  CLOSE_PROTOCOL_TOO_OLD,
  CLOSE_TOO_LARGE,
  decodeAckMessage,
  MESSAGE_ACK,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import { WebsocketProvider } from "y-websocket";
import type * as Y from "yjs";
import { setUnsynced, type NoteAccess } from "../notes/access";
import type { OpenNote } from "../notes/noteDoc";

/**
 * - offline: not connected to the server (changes are kept in this browser)
 * - syncing: connected; the server has not yet acknowledged everything this browser has
 * - synced:  the server's latest save covers everything this browser has
 * - stopped: the server refused the connection for good (revoked, deleted, too large,
 *            app too old); `closeCode` says why
 */
export type SyncState = "offline" | "syncing" | "synced" | "stopped";

/** Close codes where retrying cannot help (ARCHITECTURE.md, section 6.1). */
const TERMINAL_CLOSE_CODES = new Set([
  CLOSE_INVALID_TOKEN,
  CLOSE_NOTE_DELETED,
  CLOSE_TOO_LARGE,
  CLOSE_PROTOCOL_TOO_OLD,
]);

/** Origin `y-websocket` uses for changes it applies: they came from the server. */
type ProviderOrigin = WebsocketProvider;

/**
 * Keeps one open note in sync with the server (ADR 005): a `y-websocket` provider with
 * this browser's token, plus the `ack` check behind the status badge and the "not backed
 * up yet" marker.
 */
export class NoteSync {
  readonly provider: WebsocketProvider;
  private state: SyncState = "offline";
  private lastAck: Y.Snapshot | null = null;
  private terminalCode: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly note: OpenNote,
    access: NoteAccess,
  ) {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    this.provider = new WebsocketProvider(
      `${scheme}://${location.host}/sync`,
      note.noteId,
      note.doc,
      {
        params: { t: access.token, pv: String(PROTOCOL_VERSION) },
        // Do not hammer the server after a refusal that a retry cannot fix.
        shouldReconnect: (event: CloseEvent) => !TERMINAL_CLOSE_CODES.has(event.code),
      },
    );
    this.provider.messageHandlers[MESSAGE_ACK] = (_encoder, decoder) => {
      this.lastAck = decodeAckMessage(decoder);
      this.update();
    };
    this.provider.on("status", this.update);
    this.provider.on("connection-close", this.onClose);
    note.doc.on("update", this.onDocUpdate);
    this.update();
  }

  get syncState(): SyncState {
    return this.state;
  }

  /** The close code behind a "stopped" state, if any. */
  get closeCode(): number | null {
    return this.terminalCode;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  destroy(): void {
    this.note.doc.off("update", this.onDocUpdate);
    this.provider.destroy();
  }

  private readonly onClose = (event: CloseEvent | null): void => {
    if (event && TERMINAL_CLOSE_CODES.has(event.code)) this.terminalCode = event.code;
    this.update();
  };

  private readonly onDocUpdate = (_update: Uint8Array, origin: unknown): void => {
    // A change made here (not one the server sent) is not backed up until acknowledged.
    if ((origin as ProviderOrigin | null) !== this.provider) {
      void setUnsynced(this.note.noteId, true);
    }
    this.update();
  };

  private readonly update = (): void => {
    const covered = this.lastAck !== null && ackCovers(this.note.doc, this.lastAck);
    const next: SyncState =
      this.terminalCode !== null
        ? "stopped"
        : !this.provider.wsconnected
          ? "offline"
          : covered
            ? "synced"
            : "syncing";
    if (covered) void setUnsynced(this.note.noteId, false);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
}
