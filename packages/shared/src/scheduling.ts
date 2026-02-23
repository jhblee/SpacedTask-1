import { DateTime } from 'luxon';
import type { Task } from './types';

/**
 * Fixed review intervals in days, indexed by repetitionIndex (0..4).
 * After completing step N, the next due date is today + INTERVALS[N].
 */
export const INTERVALS = [1, 3, 7, 14, 30] as const;

export type IntervalIndex = 0 | 1 | 2 | 3 | 4;

/** Human-readable label for each interval, used in the Step label. */
export const INTERVAL_LABELS: Record<number, string> = {
  0: '1 day',
  1: '3 days',
  2: '7 days',
  3: '14 days',
  4: '30 days',
};

/**
 * Returns the next due date as a YYYY-MM-DD local date string.
 *
 * @param todayLocal - Current local date in YYYY-MM-DD format.
 * @param repetitionIndexAfterAdvance - The repetitionIndex AFTER it has been
 *   incremented (i.e., the new index, clamped to 4).
 *
 * Using luxon DateTime.fromISO + .plus({ days }) guarantees we add calendar
 * days, not wall-clock milliseconds, making this DST-safe.
 */
export function computeNextDueDate(
  todayLocal: string,
  repetitionIndexAfterAdvance: number,
): string {
  const clamped = Math.min(Math.max(repetitionIndexAfterAdvance, 0), 4);
  const days = INTERVALS[clamped as IntervalIndex];
  const result = DateTime.fromISO(todayLocal).plus({ days }).toISODate();
  if (!result) {
    throw new Error(`computeNextDueDate: invalid todayLocal "${todayLocal}"`);
  }
  return result;
}

/**
 * Returns true if the task should appear in "Today's Review Tasks."
 *
 * A task is due today when:
 *   1. nextDueDate <= todayLocal  (overdue tasks also appear)
 *   2. lastCompletedDate !== todayLocal  (not already done today)
 */
export function isDueToday(task: Task, todayLocal: string): boolean {
  return task.nextDueDate <= todayLocal && task.lastCompletedDate !== todayLocal;
}

/**
 * Returns the number of whole calendar days between startDate and todayLocal.
 * Uses luxon to avoid DST-related off-by-one errors.
 */
export function daysSinceStart(startDate: string, todayLocal: string): number {
  const start = DateTime.fromISO(startDate);
  const today = DateTime.fromISO(todayLocal);
  return Math.floor(today.diff(start, 'days').days);
}

/**
 * Returns the step label string, e.g. "Step 2/5: 3 days".
 * Uses repetitionIndex (0-based) to produce a 1-based display label.
 */
export function stepLabel(repetitionIndex: number): string {
  const display = Math.min(Math.max(repetitionIndex, 0), 4);
  return `Step ${display + 1}/5: ${INTERVAL_LABELS[display] ?? '?'}`;
}

/**
 * Computes the initial nextDueDate for a newly created task.
 * Always todayLocal + 1 day (interval at index 0).
 */
export function initialNextDueDate(todayLocal: string): string {
  return computeNextDueDate(todayLocal, 0);
}
