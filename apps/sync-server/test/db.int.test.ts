import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "../src/db/database";
import { startServer } from "../src/server";
import { makeTempDir } from "./support/tempDir";

let dir: { path: string; cleanup: () => Promise<void> };
const opened: Db[] = [];

function open(file = "test.sqlite", migrationsDir?: string): Db {
  const db = openDatabase(join(dir.path, file), migrationsDir ? { migrationsDir } : {});
  opened.push(db);
  return db;
}

function tables(db: Db): string[] {
  return db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
}

function appliedVersions(db: Db): number[] {
  return db
    .prepare<[], { version: number }>("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((r) => r.version);
}

beforeEach(async () => {
  dir = await makeTempDir();
});

afterEach(async () => {
  for (const db of opened.splice(0)) db.close();
  await dir.cleanup();
});

describe("database and migrations", () => {
  it("a fresh database has every table from the architecture", () => {
    const db = open();
    expect(tables(db)).toEqual(["notes", "schema_migrations", "snapshots", "tokens", "tombstones"]);
    expect(appliedVersions(db)).toEqual([1]);
  });

  it("running migrations again is a no-op", () => {
    open().close();
    opened.pop();
    const again = open();
    expect(appliedVersions(again)).toEqual([1]);
    expect(tables(again)).toContain("notes");
  });

  it("uses durable settings: WAL journal, full sync, foreign keys on", () => {
    const db = open();
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("synchronous", { simple: true })).toBe(2); // 2 = FULL
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("stores token hashes uniquely and rejects tokens for unknown notes", () => {
    const db = open();
    const now = Date.now();
    db.prepare(
      "INSERT INTO notes (note_id, state, schema_version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
    ).run("n1", Buffer.from([0, 0]), now, now);
    const insertToken = db.prepare(
      "INSERT INTO tokens (note_id, token_hash, role, created_at) VALUES (?, ?, 'edit', ?)",
    );
    insertToken.run("n1", Buffer.alloc(32, 1), now);
    expect(() => insertToken.run("n1", Buffer.alloc(32, 1), now)).toThrow(/UNIQUE/);
    expect(() => insertToken.run("missing", Buffer.alloc(32, 2), now)).toThrow(/FOREIGN KEY/);
  });

  it("applies new migrations in order, and a failing migration changes nothing", async () => {
    const migrations = await makeTempDir({
      "001_first.sql": "CREATE TABLE a (x INT);",
      "002_second.sql": "CREATE TABLE b (x INT);",
    });
    try {
      const db = open("custom.sqlite", migrations.path);
      expect(appliedVersions(db)).toEqual([1, 2]);
      db.close();
      opened.pop();

      const broken = await makeTempDir({
        "001_first.sql": "CREATE TABLE a (x INT);",
        "002_second.sql": "CREATE TABLE b (x INT);",
        "003_broken.sql": "CREATE TABLE c (x INT); THIS IS NOT SQL;",
      });
      try {
        expect(() => open("custom.sqlite", broken.path)).toThrow();
        const after = open("custom.sqlite", migrations.path);
        expect(appliedVersions(after)).toEqual([1, 2]);
        expect(tables(after)).not.toContain("c"); // the half-run migration was rolled back
      } finally {
        await broken.cleanup();
      }
    } finally {
      await migrations.cleanup();
    }
  });

  it("the server opens its database file and creates the schema", async () => {
    const server = await startServer({ port: 0, databasePath: join(dir.path, "server.sqlite") });
    try {
      expect(tables(server.db)).toContain("tokens");
    } finally {
      await server.close();
    }
  });
});
