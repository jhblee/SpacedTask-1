import { describe, it, expect } from 'vitest';
import {
  computeNextDueDate,
  isDueToday,
  daysSinceStart,
  stepLabel,
  initialNextDueDate,
  INTERVALS,
} from '../scheduling';
import type { Task } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test task',
    startDate: '2024-01-01',
    repetitionIndex: 0,
    nextDueDate: '2024-01-02',
    lastCompletedDate: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeNextDueDate
// ---------------------------------------------------------------------------
describe('computeNextDueDate', () => {
  it('adds correct days for each index (0..4)', () => {
    const today = '2024-03-01';
    expect(computeNextDueDate(today, 0)).toBe('2024-03-02'); // +1
    expect(computeNextDueDate(today, 1)).toBe('2024-03-04'); // +3
    expect(computeNextDueDate(today, 2)).toBe('2024-03-08'); // +7
    expect(computeNextDueDate(today, 3)).toBe('2024-03-15'); // +14
    expect(computeNextDueDate(today, 4)).toBe('2024-03-31'); // +30
  });

  it('clamps index above 4 to 4', () => {
    expect(computeNextDueDate('2024-01-01', 99)).toBe(
      computeNextDueDate('2024-01-01', 4),
    );
  });

  it('clamps negative index to 0', () => {
    expect(computeNextDueDate('2024-01-01', -1)).toBe(
      computeNextDueDate('2024-01-01', 0),
    );
  });

  it('crosses month boundary correctly', () => {
    expect(computeNextDueDate('2024-01-30', 0)).toBe('2024-01-31');
    expect(computeNextDueDate('2024-01-31', 0)).toBe('2024-02-01');
  });

  it('crosses year boundary correctly', () => {
    expect(computeNextDueDate('2024-12-31', 0)).toBe('2025-01-01');
  });

  it('is DST-safe: spring-forward day (US Eastern 2024-03-10)', () => {
    // On DST spring-forward, a naive +86400000ms approach can produce the wrong date.
    // Luxon uses calendar-day arithmetic, so this must always be +1 day.
    expect(computeNextDueDate('2024-03-10', 0)).toBe('2024-03-11');
  });

  it('is DST-safe: fall-back day (US Eastern 2024-11-03)', () => {
    expect(computeNextDueDate('2024-11-03', 0)).toBe('2024-11-04');
  });

  it('throws on invalid date string', () => {
    expect(() => computeNextDueDate('not-a-date', 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isDueToday
// ---------------------------------------------------------------------------
describe('isDueToday', () => {
  it('returns true when nextDueDate equals todayLocal and not completed', () => {
    const task = makeTask({ nextDueDate: '2024-03-05', lastCompletedDate: null });
    expect(isDueToday(task, '2024-03-05')).toBe(true);
  });

  it('returns true for overdue tasks (nextDueDate in the past)', () => {
    const task = makeTask({ nextDueDate: '2024-02-01', lastCompletedDate: null });
    expect(isDueToday(task, '2024-03-05')).toBe(true);
  });

  it('returns false when nextDueDate is in the future', () => {
    const task = makeTask({ nextDueDate: '2024-03-10', lastCompletedDate: null });
    expect(isDueToday(task, '2024-03-05')).toBe(false);
  });

  it('returns false when task was already completed today (same-day lock)', () => {
    const task = makeTask({
      nextDueDate: '2024-03-05',
      lastCompletedDate: '2024-03-05',
    });
    expect(isDueToday(task, '2024-03-05')).toBe(false);
  });

  it('returns true when completed on a previous day but due again today', () => {
    const task = makeTask({
      nextDueDate: '2024-03-05',
      lastCompletedDate: '2024-02-01',
    });
    expect(isDueToday(task, '2024-03-05')).toBe(true);
  });

  it('overdue + completed today → false (same-day lock wins)', () => {
    const task = makeTask({
      nextDueDate: '2024-01-01',
      lastCompletedDate: '2024-03-05',
    });
    expect(isDueToday(task, '2024-03-05')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// daysSinceStart
// ---------------------------------------------------------------------------
describe('daysSinceStart', () => {
  it('returns 0 when start equals today', () => {
    expect(daysSinceStart('2024-01-01', '2024-01-01')).toBe(0);
  });

  it('returns correct day count', () => {
    expect(daysSinceStart('2024-01-01', '2024-01-08')).toBe(7);
    expect(daysSinceStart('2024-01-01', '2024-02-01')).toBe(31);
  });

  it('handles leap years correctly', () => {
    // 2024 is a leap year; Feb has 29 days
    expect(daysSinceStart('2024-02-01', '2024-03-01')).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// stepLabel
// ---------------------------------------------------------------------------
describe('stepLabel', () => {
  it('produces correct labels for each index', () => {
    expect(stepLabel(0)).toBe('Step 1/5: 1 day');
    expect(stepLabel(1)).toBe('Step 2/5: 3 days');
    expect(stepLabel(2)).toBe('Step 3/5: 7 days');
    expect(stepLabel(3)).toBe('Step 4/5: 14 days');
    expect(stepLabel(4)).toBe('Step 5/5: 30 days');
  });

  it('clamps out-of-range values', () => {
    expect(stepLabel(-1)).toBe(stepLabel(0));
    expect(stepLabel(99)).toBe(stepLabel(4));
  });
});

// ---------------------------------------------------------------------------
// initialNextDueDate
// ---------------------------------------------------------------------------
describe('initialNextDueDate', () => {
  it('always returns todayLocal + 1 day', () => {
    expect(initialNextDueDate('2024-06-15')).toBe('2024-06-16');
    expect(initialNextDueDate('2024-12-31')).toBe('2025-01-01');
  });
});

// ---------------------------------------------------------------------------
// INTERVALS constant sanity check
// ---------------------------------------------------------------------------
describe('INTERVALS', () => {
  it('has exactly 5 entries matching the spec', () => {
    expect(INTERVALS).toHaveLength(5);
    expect([...INTERVALS]).toEqual([1, 3, 7, 14, 30]);
  });
});
