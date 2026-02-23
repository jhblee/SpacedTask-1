import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type Database from 'better-sqlite3';
import { DateTime } from 'luxon';
import { getAllTasks, createTask, completeTask, resetTask, deleteTask } from '@spacedtask/db';
import { IPC_CHANNELS, SetMockDateInputSchema } from '@spacedtask/shared';
import { logger } from '../logger';

/**
 * Holds the mock date for E2E / test scenarios.
 * null means "use real today".
 */
let mockDateOverride: string | null = null;

export function getTodayLocal(): string {
  if (mockDateOverride !== null) return mockDateOverride;
  const result = DateTime.now().toISODate();
  if (!result) throw new Error('Failed to get local date from Luxon');
  return result;
}

/**
 * Registers all IPC handlers on ipcMain.
 * Should be called once during app startup, after the DB is open.
 *
 * @param db - The open SQLite database connection.
 * @param isDev - Set true to enable the test mock-date channel.
 */
export function registerIpcHandlers(db: Database.Database, isDev: boolean): void {
  // ------------------------------------------------------------------
  // tasks:getAll
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TASKS_GET_ALL, (_event: IpcMainInvokeEvent) => {
    try {
      return { ok: true, data: getAllTasks(db) };
    } catch (err) {
      logger.error('tasks:getAll error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // tasks:create
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TASKS_CREATE, (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const today = getTodayLocal();
      const task = createTask(db, input, today);
      return { ok: true, data: task };
    } catch (err) {
      logger.error('tasks:create error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // tasks:complete
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TASKS_COMPLETE, (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const today = getTodayLocal();
      const task = completeTask(db, input, today);
      return { ok: true, data: task };
    } catch (err) {
      logger.error('tasks:complete error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // tasks:reset
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TASKS_RESET, (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const today = getTodayLocal();
      const task = resetTask(db, input, today);
      return { ok: true, data: task };
    } catch (err) {
      logger.error('tasks:reset error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // tasks:delete
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TASKS_DELETE, (_event: IpcMainInvokeEvent, input: unknown) => {
    try {
      const deleted = deleteTask(db, input);
      return { ok: true, data: deleted };
    } catch (err) {
      logger.error('tasks:delete error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // app:getTodayLocal
  // ------------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.APP_GET_TODAY, () => {
    try {
      return { ok: true, data: getTodayLocal() };
    } catch (err) {
      logger.error('app:getTodayLocal error', err);
      return { ok: false, error: String(err) };
    }
  });

  // ------------------------------------------------------------------
  // __test__:setMockDate  (only in dev/test; never exposed in production)
  // ------------------------------------------------------------------
  if (isDev) {
    ipcMain.handle(
      IPC_CHANNELS.TEST_SET_MOCK_DATE,
      (_event: IpcMainInvokeEvent, input: unknown) => {
        try {
          const { date } = SetMockDateInputSchema.parse(input);
          mockDateOverride = date;
          logger.debug('Mock date set to', mockDateOverride);
          return { ok: true, data: mockDateOverride };
        } catch (err) {
          logger.error('__test__:setMockDate error', err);
          return { ok: false, error: String(err) };
        }
      },
    );
  }
}
