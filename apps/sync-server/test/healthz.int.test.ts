import { afterEach, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/server";

let server: RunningServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("GET /healthz", () => {
  it("responds 200 with { status: 'ok' }", async () => {
    server = await startServer({ port: 0 }); // port 0 = any free port

    const res = await fetch(`http://127.0.0.1:${server.port}/healthz`);

    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ status: "ok" });
  });

  it("responds 404 for unknown paths", async () => {
    server = await startServer({ port: 0 });

    const res = await fetch(`http://127.0.0.1:${server.port}/nope`);

    expect(res.status).toBe(404);
  });
});
