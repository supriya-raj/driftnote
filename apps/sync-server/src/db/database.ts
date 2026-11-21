import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The SQLite connection. Every database access in the server goes through this module, so
 * switching to the built-in `node:sqlite` later (once it is stable, ADR 008) is local.
 */
export type Db = Database.Database;

const DEFAULT_MIGRATIONS_DIR = join(import.meta.dirname, "migrations");
const MIGRATION_FILE = /^(\d+)_[\w-]+\.sql$/;

export interface OpenOptions {
  /** Folder of `NNN_name.sql` files; defaults to the server's own migrations. */
  readonly migrationsDir?: string;
}

/** Opens (or creates) the database file, applies settings and pending migrations. */
export function openDatabase(path: string, options: OpenOptions = {}): Db {
  const db = new Database(path);
  try {
    // Write-ahead log: readers never block the single writer.
    db.pragma("journal_mode = WAL");
    // A transaction counts as committed only once it is on disk; the `ack` promise
    // ("your change is durably saved", ADR 005) depends on this.
    db.pragma("synchronous = FULL");
    // SQLite ignores REFERENCES unless this is on, per connection.
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db, options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

/**
 * Applies each migration file whose number is not yet in `schema_migrations`, in order.
 * Each file runs in its own transaction together with its bookkeeping row, so a failing
 * migration leaves no trace and can be fixed and re-run (ADR 012).
 */
function migrate(db: Db, dir: string): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    db
      .prepare<[], { version: number }>("SELECT version FROM schema_migrations")
      .all()
      .map((r) => r.version),
  );

  const pending = readdirSync(dir)
    .map((file) => ({ file, match: MIGRATION_FILE.exec(file) }))
    .filter((m): m is { file: string; match: RegExpExecArray } => m.match !== null)
    .map(({ file, match }) => ({ file, version: Number(match[1]) }))
    .filter(({ version }) => !applied.has(version))
    .sort((a, b) => a.version - b.version);

  const record = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");
  for (const { file, version } of pending) {
    const sql = readFileSync(join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(version, Date.now());
    })();
  }
}
