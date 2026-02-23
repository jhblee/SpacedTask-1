/**
 * Preload script — runs in a sandboxed renderer context.
 *
 * Security model:
 *   - contextIsolation: true  → this script runs in an isolated world; the
 *     renderer JS cannot access Node.js or Electron APIs directly.
 *   - nodeIntegration: false  → renderer cannot require() modules.
 *   - contextBridge.exposeInMainWorld → the ONLY bridge between renderer and
 *     main process. Every exposed function is explicitly allow-listed here.
 *
 * Only invoke channels that are defined in IPC_CHANNELS are used, preventing
 * channel name typos from silently failing.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@spacedtask/shared';
import type { ElectronAPI } from '@spacedtask/shared';

const api: ElectronAPI = {
  getTasks: () => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET_ALL),
  createTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_CREATE, input),
  completeTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_COMPLETE, input),
  resetTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_RESET, input),
  deleteTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_DELETE, input),
  getTodayLocal: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_TODAY),
  setMockDate: (input) => ipcRenderer.invoke(IPC_CHANNELS.TEST_SET_MOCK_DATE, input),
};

contextBridge.exposeInMainWorld('electronAPI', api);
