import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

export { getAllTasks, createTask, completeTask, resetTask, deleteTask } from './queries';
export { runMigrations } from './migrations';

/**
 * Opens (or creates) the SQLite database at the given path, applies all
 * pending migrations, and returns the connection.
 *
 * WAL mode is enabled for better read/write concurrency and crash safety.
 */
export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode for improved performance and crash safety
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}
