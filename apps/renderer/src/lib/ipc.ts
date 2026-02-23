/**
 * Typed wrapper around window.electronAPI.
 *
 * This module is the single place where the renderer calls the preload API.
 * Components and hooks should import from here, not reference window.electronAPI
 * directly — keeping TypeScript coverage complete and making tests easier to mock.
 */

import type { ElectronAPI } from '@spacedtask/shared';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/** Unwraps an IPC result envelope or throws with the error message. */
async function unwrap<T>(call: Promise<{ ok: boolean; data?: T; error?: string }>): Promise<T> {
  const result = await call;
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? 'Unknown IPC error');
  }
  return result.data;
}

export const ipc = {
  getTasks: () => unwrap(window.electronAPI.getTasks()),
  createTask: (title: string) => unwrap(window.electronAPI.createTask({ title })),
  completeTask: (id: string) => unwrap(window.electronAPI.completeTask({ id })),
  resetTask: (id: string) => unwrap(window.electronAPI.resetTask({ id })),
  deleteTask: (id: string) => unwrap(window.electronAPI.deleteTask({ id })),
  getTodayLocal: () => unwrap(window.electronAPI.getTodayLocal()),
  setMockDate: (date: string | null) => unwrap(window.electronAPI.setMockDate({ date })),
};
