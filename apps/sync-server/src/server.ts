import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface ServerOptions {
  /** Port to listen on; 0 picks any free port (used by tests). */
  readonly port: number;
  readonly host?: string;
}

export interface RunningServer {
  /** The port actually bound (useful when `port: 0` was requested). */
  readonly port: number;
  close(): Promise<void>;
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end();
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const http = createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port, options.host ?? "127.0.0.1", () => {
      http.off("error", reject);
      resolve();
    });
  });

  const address = http.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the server to be bound to a TCP port");
  }

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        http.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}
