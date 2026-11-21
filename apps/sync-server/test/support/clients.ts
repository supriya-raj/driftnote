import { createToken, decodeAckMessage, MESSAGE_ACK, PROTOCOL_VERSION } from "@driftnote/shared";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface TestClient {
  readonly doc: Y.Doc;
  readonly provider: WebsocketProvider;
  readonly text: Y.Text;
  /** Save acknowledgements received, oldest first. */
  readonly acks: Y.Snapshot[];
  /** Resolves once the provider has completed the initial sync with the server. */
  synced(): Promise<void>;
  destroy(): void;
}

const clients = new Set<TestClient>();

const ownerTokens = new Map<string, string>();

/**
 * The token used when a test does not pass one: one per note, like the app (every note
 * has its own owner token). The first client to open a new note claims it as owner, so
 * every default client of that note is the owner.
 */
export function defaultTokenFor(noteId: string): string {
  let token = ownerTokens.get(noteId);
  if (!token) {
    token = createToken();
    ownerTokens.set(noteId, token);
  }
  return token;
}

/**
 * A real Yjs client (the stock `y-websocket` provider) connected to the test server.
 * `disableBc` matters: test clients share one process, and BroadcastChannel would let
 * them sync with each other directly, hiding server bugs. Every change must go through
 * the server.
 */
export function connectClient(
  port: number,
  noteId: string,
  options: { token?: string; protocolVersion?: number } = {},
): TestClient {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(`ws://127.0.0.1:${String(port)}/sync`, noteId, doc, {
    WebSocketPolyfill: WebSocket,
    disableBc: true,
    params: {
      t: options.token ?? defaultTokenFor(noteId),
      pv: String(options.protocolVersion ?? PROTOCOL_VERSION),
    },
  });
  const acks: Y.Snapshot[] = [];
  // The stock provider has no handler for Driftnote's ack message; register one.
  provider.messageHandlers[MESSAGE_ACK] = (_encoder, decoder) => {
    acks.push(decodeAckMessage(decoder));
  };
  const client: TestClient = {
    doc,
    provider,
    acks,
    text: doc.getText("t"),
    synced: () =>
      provider.synced
        ? Promise.resolve()
        : new Promise((resolve) => {
            const onSync = (isSynced: boolean): void => {
              if (!isSynced) return;
              provider.off("sync", onSync);
              resolve();
            };
            provider.on("sync", onSync);
          }),
    destroy: () => {
      clients.delete(client);
      provider.destroy();
      doc.destroy();
    },
  };
  clients.add(client);
  return client;
}

/** Destroys every client created by `connectClient` (call in afterEach). */
export function destroyAllClients(): void {
  for (const client of [...clients]) client.destroy();
}
