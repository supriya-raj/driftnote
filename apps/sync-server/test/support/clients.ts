import { PROTOCOL_VERSION } from "@driftnote/shared";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface TestClient {
  readonly doc: Y.Doc;
  readonly provider: WebsocketProvider;
  readonly text: Y.Text;
  /** Resolves once the provider has completed the initial sync with the server. */
  synced(): Promise<void>;
  destroy(): void;
}

const clients = new Set<TestClient>();

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
      t: options.token ?? "test-token",
      pv: String(options.protocolVersion ?? PROTOCOL_VERSION),
    },
  });
  const client: TestClient = {
    doc,
    provider,
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
