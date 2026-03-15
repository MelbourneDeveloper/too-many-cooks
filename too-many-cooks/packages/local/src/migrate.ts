/// Applies Prisma-generated SQLite migrations using better-sqlite3.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";

/** SQL to create Prisma's migration tracking table. */
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id TEXT PRIMARY KEY NOT NULL,
  checksum TEXT NOT NULL,
  finished_at DATETIME,
  migration_name TEXT NOT NULL,
  logs TEXT,
  rolled_back_at DATETIME,
  started_at DATETIME NOT NULL DEFAULT current_timestamp,
  applied_steps_count INTEGER NOT NULL DEFAULT 0
)`;

/** Directory of the compiled file — works from src/ (tsx) and build/src/ (node). */
const CURRENT_DIR = fileURLToPath(new URL(".", import.meta.url));

/** Locate the prisma/migrations directory relative to this file. */
const migrationsDir = (): string => {
  const candidates = [
    resolve(CURRENT_DIR, "..", "prisma", "migrations"),      // src/ (tsx dev)
    resolve(CURRENT_DIR, "..", "..", "prisma", "migrations"), // build/src/ (node)
  ];
  const found = candidates.find(existsSync);
  if (found === undefined) throw new Error(`Cannot find migrations dir. Tried: ${candidates.join(", ")}`);
  return found;
};

/** Simple deterministic checksum for migration tracking. */
const checksum = (sql: string): string => {
  let h = 0;
  for (const c of sql) { h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; }
  return String(h >>> 0);
};

/** Check whether a migration has already been applied. */
const isApplied = (db: Database.Database, name: string): boolean =>
  db.prepare("SELECT id FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL")
    .get(name) !== undefined;

/** Record a successfully applied migration. */
const recordMigration = (db: Database.Database, name: string, sql: string): void => {
  db.prepare(
    "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, datetime('now'), ?, 1)",
  ).run(randomUUID(), checksum(sql), name);
};

/** True if the identity table already exists but no current migrations are recorded.
 *  Handles both pre-Prisma databases and databases where migrations were renamed. */
const hasPrePrismaSchema = (db: Database.Database, migrations: readonly string[]): boolean => {
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='identity'").get() === undefined) {
    return false;
  }
  if (db.prepare("SELECT 1 FROM _prisma_migrations LIMIT 1").get() === undefined) {
    return true;
  }
  // If none of the current migration names are recorded, the schema was created
  // by an older or renamed migration — treat as pre-Prisma and baseline.
  return migrations.every(
    (name) => db.prepare("SELECT 1 FROM _prisma_migrations WHERE migration_name = ?").get(name) === undefined,
  );
};

/** Baseline an existing pre-Prisma database by recording all migrations as applied. */
const baselineMigrations = (db: Database.Database, dir: string, names: readonly string[]): void => {
  for (const name of names) {
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf-8");
    recordMigration(db, name, sql);
  }
};

/** Apply all pending Prisma migrations to the database. */
export const applyMigrations = (db: Database.Database): void => {
  db.exec(CREATE_MIGRATIONS_TABLE);
  const dir = migrationsDir();
  const migrations = readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "migration.sql")))
    .sort();
  if (hasPrePrismaSchema(db, migrations)) { baselineMigrations(db, dir, migrations); return; }
  for (const name of migrations) {
    if (isApplied(db, name)) continue;
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf-8");
    db.exec(sql);
    recordMigration(db, name, sql);
  }
};
