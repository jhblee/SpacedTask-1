import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase, runMigrations } from '../index';
import { getAllTasks, createTask, completeTask, resetTask, deleteTask } from '../queries';

// ---------------------------------------------------------------------------
// Setup: in-memory SQLite for each test
// ---------------------------------------------------------------------------
let db: Database.Database;

beforeEach(() => {
  // ':memory:' gives a fresh isolated DB per test
  db = openDatabase(':memory:');
});

// ---------------------------------------------------------------------------
// getAllTasks
// ---------------------------------------------------------------------------
describe('getAllTasks', () => {
  it('returns empty array on fresh DB', () => {
    expect(getAllTasks(db)).toEqual([]);
  });

  it('returns tasks ordered by createdAt', () => {
    createTask(db, { title: 'First' }, '2024-01-01');
    createTask(db, { title: 'Second' }, '2024-01-01');
    const tasks = getAllTasks(db);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.title).toBe('First');
    expect(tasks[1]?.title).toBe('Second');
  });
});

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------
describe('createTask', () => {
  it('creates a task with correct default fields', () => {
    const today = '2024-03-15';
    const task = createTask(db, { title: 'Review notes' }, today);

    expect(task.title).toBe('Review notes');
    expect(task.startDate).toBe(today);
    expect(task.repetitionIndex).toBe(0);
    expect(task.nextDueDate).toBe('2024-03-16'); // today + 1
    expect(task.lastCompletedDate).toBeNull();
    expect(task.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects empty title', () => {
    expect(() => createTask(db, { title: '' }, '2024-01-01')).toThrow();
  });

  it('rejects whitespace-only title', () => {
    expect(() => createTask(db, { title: '   ' }, '2024-01-01')).toThrow();
  });

  it('persists the task to the database', () => {
    createTask(db, { title: 'Persist me' }, '2024-01-01');
    expect(getAllTasks(db)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// completeTask
// ---------------------------------------------------------------------------
describe('completeTask', () => {
  it('advances repetitionIndex and sets nextDueDate', () => {
    const today = '2024-03-15';
    const task = createTask(db, { title: 'Study' }, today);
    // task.repetitionIndex is 0, nextDueDate was today+1

    const completed = completeTask(db, { id: task.id }, today);
    expect(completed.repetitionIndex).toBe(1);
    expect(completed.lastCompletedDate).toBe(today);
    expect(completed.nextDueDate).toBe('2024-03-18'); // today + 3 (INTERVALS[1])
  });

  it('advances through all steps correctly', () => {
    const today = '2024-01-01';
    const task = createTask(db, { title: 'Multi-step' }, today);
    const intervals = [1, 3, 7, 14, 30];

    let current = task;
    for (let i = 0; i < intervals.length; i++) {
      // Simulate each review on the due date
      const fakeToday = current.nextDueDate;
      current = completeTask(db, { id: task.id }, fakeToday);
      const expectedIndex = Math.min(i + 1, 4);
      expect(current.repetitionIndex).toBe(expectedIndex);
    }
  });

  it('clamps repetitionIndex at 4 (does not exceed max)', () => {
    const today = '2024-01-01';
    // Manually set a task at max step
    const task = createTask(db, { title: 'Max step' }, today);
    db.prepare(
      "UPDATE tasks SET repetition_index = 4, next_due_date = '2024-02-01' WHERE id = ?",
    ).run(task.id);

    const completed = completeTask(db, { id: task.id }, '2024-02-01');
    expect(completed.repetitionIndex).toBe(4); // clamped
    expect(completed.nextDueDate).toBe('2024-03-02'); // 2024-02-01 + 30
  });

  it('is idempotent — completing twice on same day does not double-advance', () => {
    const today = '2024-03-15';
    const task = createTask(db, { title: 'Idempotent' }, today);

    const first = completeTask(db, { id: task.id }, today);
    const second = completeTask(db, { id: task.id }, today);

    expect(second.repetitionIndex).toBe(first.repetitionIndex);
    expect(second.nextDueDate).toBe(first.nextDueDate);
    expect(second.lastCompletedDate).toBe(today);
  });

  it('throws when task not found', () => {
    expect(() =>
      completeTask(db, { id: '00000000-0000-0000-0000-000000000000' }, '2024-01-01'),
    ).toThrow('Task not found');
  });

  it('rejects invalid UUID', () => {
    expect(() => completeTask(db, { id: 'not-a-uuid' }, '2024-01-01')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// resetTask
// ---------------------------------------------------------------------------
describe('resetTask', () => {
  it('resets to newly-created state', () => {
    const originalDate = '2024-01-01';
    const task = createTask(db, { title: 'Reset me' }, originalDate);

    // Complete it a couple of times
    completeTask(db, { id: task.id }, originalDate);
    completeTask(db, { id: task.id }, '2024-01-04'); // nextDue after step 1

    const resetDate = '2024-06-01';
    const reset = resetTask(db, { id: task.id }, resetDate);

    expect(reset.startDate).toBe(resetDate);
    expect(reset.repetitionIndex).toBe(0);
    expect(reset.lastCompletedDate).toBeNull();
    expect(reset.nextDueDate).toBe('2024-06-02'); // resetDate + 1
  });

  it('throws when task not found', () => {
    expect(() =>
      resetTask(db, { id: '00000000-0000-0000-0000-000000000000' }, '2024-01-01'),
    ).toThrow('Task not found');
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------
describe('deleteTask', () => {
  it('removes the task from the DB', () => {
    const task = createTask(db, { title: 'Delete me' }, '2024-01-01');
    expect(getAllTasks(db)).toHaveLength(1);

    const deleted = deleteTask(db, { id: task.id });
    expect(deleted).toBe(true);
    expect(getAllTasks(db)).toHaveLength(0);
  });

  it('returns false when task does not exist', () => {
    const deleted = deleteTask(db, { id: '00000000-0000-0000-0000-000000000099' });
    expect(deleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Migration idempotency
// ---------------------------------------------------------------------------
describe('runMigrations', () => {
  it('can be called multiple times without error', () => {
    // openDatabase already runs migrations; calling it again on same DB is safe
    expect(() => runMigrations(db)).not.toThrow();
    expect(() => runMigrations(db)).not.toThrow();
  });
});
