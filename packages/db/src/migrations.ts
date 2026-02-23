import type Database from 'better-sqlite3';

/**
 * Embedded SQL migrations.
 * Each entry is applied exactly once, tracked by name in `schema_migrations`.
 * Adding new entries to this array is how you evolve the schema safely.
 */
const MIGRATIONS: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: '0000_init',
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id                  TEXT    PRIMARY KEY,
        title               TEXT    NOT NULL,
        start_date          TEXT    NOT NULL,
        repetition_index    INTEGER NOT NULL DEFAULT 0,
        next_due_date       TEXT    NOT NULL,
        last_completed_date TEXT,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL
      );
    `,
  },
];

/**
 * Runs all pending migrations against the provided database connection.
 * Creates a `schema_migrations` tracking table on first run.
 * Safe to call on every app startup — already-applied migrations are skipped.
 */
export function runMigrations(db: Database.Database): void {
  // Bootstrap the tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT    NOT NULL UNIQUE,
      run_at  TEXT    NOT NULL
    )
  `);

  const checkStmt = db.prepare<[string], { id: number }>(
    'SELECT id FROM schema_migrations WHERE name = ?',
  );
  const recordStmt = db.prepare('INSERT INTO schema_migrations (name, run_at) VALUES (?, ?)');

  for (const migration of MIGRATIONS) {
    const existing = checkStmt.get(migration.name);
    if (!existing) {
      db.exec(migration.sql);
      recordStmt.run(migration.name, new Date().toISOString());
    }
  }
}
