import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  computeNextDueDate,
  initialNextDueDate,
  CreateTaskInputSchema,
  CompleteTaskInputSchema,
  ResetTaskInputSchema,
  DeleteTaskInputSchema,
} from '@spacedtask/shared';
import type { Task } from '@spacedtask/shared';

// ---------------------------------------------------------------------------
// Row ↔ Domain mapping
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  title: string;
  start_date: string;
  repetition_index: number;
  next_due_date: string;
  last_completed_date: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    repetitionIndex: row.repetition_index,
    nextDueDate: row.next_due_date,
    lastCompletedDate: row.last_completed_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Returns all tasks ordered by createdAt ascending. */
export function getAllTasks(db: Database.Database): Task[] {
  const rows = db.prepare<[], TaskRow>('SELECT * FROM tasks ORDER BY created_at ASC').all();
  return rows.map(rowToTask);
}

/**
 * Creates a new task.
 * @param db - Database connection.
 * @param input - Validated input with a trimmed title.
 * @param todayLocal - Current local date YYYY-MM-DD (injected for testability).
 */
export function createTask(db: Database.Database, input: unknown, todayLocal: string): Task {
  const { title } = CreateTaskInputSchema.parse(input);
  const now = new Date().toISOString();
  const id = randomUUID();

  const row: TaskRow = {
    id,
    title,
    start_date: todayLocal,
    repetition_index: 0,
    next_due_date: initialNextDueDate(todayLocal),
    last_completed_date: null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `
    INSERT INTO tasks
      (id, title, start_date, repetition_index, next_due_date, last_completed_date, created_at, updated_at)
    VALUES
      (@id, @title, @start_date, @repetition_index, @next_due_date, @last_completed_date, @created_at, @updated_at)
  `,
  ).run(row);

  return rowToTask(row);
}

/**
 * Marks a task as completed for today:
 *  - Sets lastCompletedDate = todayLocal
 *  - Advances repetitionIndex (clamped at 4)
 *  - Sets nextDueDate = todayLocal + INTERVALS[newIndex]
 *
 * Idempotent: if already completed today, returns the current state unchanged.
 */
export function completeTask(db: Database.Database, input: unknown, todayLocal: string): Task {
  const { id } = CompleteTaskInputSchema.parse(input);

  const existing = db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) throw new Error(`Task not found: ${id}`);

  // Idempotency guard — already completed today
  if (existing.last_completed_date === todayLocal) {
    return rowToTask(existing);
  }

  const newIndex = Math.min(existing.repetition_index + 1, 4);
  const newNextDue = computeNextDueDate(todayLocal, newIndex);
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE tasks
    SET last_completed_date = ?,
        repetition_index    = ?,
        next_due_date       = ?,
        updated_at          = ?
    WHERE id = ?
  `,
  ).run(todayLocal, newIndex, newNextDue, now, id);

  const updated = db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(id)!;
  return rowToTask(updated);
}

/**
 * Resets a task as if it were newly created today:
 *  - startDate = todayLocal
 *  - repetitionIndex = 0
 *  - lastCompletedDate = null
 *  - nextDueDate = todayLocal + 1 day
 */
export function resetTask(db: Database.Database, input: unknown, todayLocal: string): Task {
  const { id } = ResetTaskInputSchema.parse(input);

  const existing = db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) throw new Error(`Task not found: ${id}`);

  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE tasks
    SET start_date          = ?,
        repetition_index    = 0,
        next_due_date       = ?,
        last_completed_date = NULL,
        updated_at          = ?
    WHERE id = ?
  `,
  ).run(todayLocal, initialNextDueDate(todayLocal), now, id);

  const updated = db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(id)!;
  return rowToTask(updated);
}

/** Deletes a task permanently. Returns true if a row was deleted. */
export function deleteTask(db: Database.Database, input: unknown): boolean {
  const { id } = DeleteTaskInputSchema.parse(input);
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}
