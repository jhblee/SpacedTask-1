import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { openDatabase } from '@spacedtask/db';
import { registerIpcHandlers } from './ipc/handlers';
import { logger } from './logger';

const isDev = process.env['NODE_ENV'] === 'development' && !app.isPackaged;

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
function getDbPath(): string {
  // In packaged app: store in user data directory (platform-appropriate)
  // In dev: store in the project root for easy inspection
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'spacedtask.db');
  }
  return path.join(app.getPath('userData'), 'spacedtask-dev.db');
}

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------
function applyCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            // Vite dev server needs 'unsafe-inline' for HMR; strip in prod
            isDev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
            "script-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'" + (isDev ? ' ws://localhost:5173' : ''),
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        ],
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow(db: import('better-sqlite3').Database): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 640,
    minHeight: 480,
    title: 'SpacedTask',
    webPreferences: {
      // SECURITY: contextIsolation prevents renderer from accessing Node APIs
      contextIsolation: true,
      // SECURITY: nodeIntegration disabled — renderer runs as untrusted web content
      nodeIntegration: false,
      // SECURITY: sandbox isolates the renderer process at OS level
      sandbox: true,
      // Preload exposes the narrow IPC API via contextBridge
      preload: path.join(__dirname, 'preload.js'),
      // Disable navigation to external URLs
      allowRunningInsecureContent: false,
    },
  });

  // Prevent renderer from opening new windows or navigating away
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = isDev ? 'http://localhost:5173' : `file://${__dirname}`;
    if (!url.startsWith(rendererUrl)) {
      logger.warn('Blocked navigation to external URL:', url);
      event.preventDefault();
    }
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    void win.loadFile(
      path.join(__dirname, '../../renderer/dist/index.html'),
    );
  }

  registerIpcHandlers(db, isDev);

  return win;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
void app.whenReady().then(() => {
  applyCSP();

  let db: import('better-sqlite3').Database;
  try {
    const dbPath = getDbPath();
    logger.info('Opening database at', dbPath);
    db = openDatabase(dbPath);
  } catch (err) {
    logger.error('Failed to open database', err);
    app.quit();
    return;
  }

  createWindow(db);

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked with no open windows
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(db);
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS it's conventional to keep the app in the dock until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent second instance from opening
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
