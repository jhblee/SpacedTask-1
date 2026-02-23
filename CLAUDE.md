# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all unit tests (auto-swaps better-sqlite3 to Node ABI first)
npm test

# Run unit tests with coverage (≥80% threshold enforced)
npm run test:coverage

# Run a single test file
npx vitest run packages/shared/src/__tests__/scheduling.test.ts
npx vitest run packages/db/src/__tests__/queries.test.ts

# Build all packages in dependency order
npm run build

# Build a single package
npm run build -w packages/shared
npm run build -w packages/db
npm run build -w apps/main
npm run build -w apps/renderer   # Vite bundle → apps/renderer/dist/

# Launch the app (production mode, auto-swaps better-sqlite3 to Electron ABI first)
npm start

# Lint (zero warnings tolerated)
npm run lint

# Format
npm run format
npm run format:check
```

**Do not use `pnpm`** — the project uses npm workspaces (pnpm fails due to OneDrive hard-link restrictions).

## Architecture

### Monorepo layout

```
packages/shared   →  packages/db  →  apps/main  (Electron main process)
                  ↘                ↗
                   apps/renderer   (React/Vite renderer)
```

Build order matters: `shared` must be built before `db`, both before `main`. Renderer has its own Vite build and resolves `@spacedtask/shared` via a path alias pointing directly at `packages/shared/src` (no compile step needed during Vite builds).

### Data flow (IPC)

```
Renderer (React) → window.electronAPI → preload.ts (contextBridge) → ipcMain handlers → SQLite
```

- `packages/shared/src/types.ts` is the **single source of truth** for `ElectronAPI`, `IpcResult<T>`, `Task`, and `IPC_CHANNELS`. All three layers import from `@spacedtask/shared` — never from each other's source trees (TypeScript `rootDir` would reject cross-project imports).
- `preload.ts` is sandboxed (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`). It may only import from `@spacedtask/shared`, never from `apps/main/src`.
- Every IPC handler returns `{ ok: true, data }` or `{ ok: false, error: string }`. Handlers validate all inputs with Zod schemas from `packages/shared/src/schemas.ts` before touching the DB.

### Date handling

**All dates are YYYY-MM-DD strings, never `Date` objects.** Luxon is used exclusively for date arithmetic (adding calendar days, not milliseconds) to avoid DST bugs. The pattern everywhere is:

```ts
import { DateTime } from 'luxon';
DateTime.fromISO(dateStr).plus({ days: n }).toISODate()
```

`getTodayLocal()` in `apps/main/src/ipc/handlers.ts` returns `DateTime.now().toISODate()` (the machine's local date). In E2E tests, this is overridden via the `__test__:setMockDate` IPC channel (dev/test only).

### Scheduling logic

`packages/shared/src/scheduling.ts` is pure (no side effects, no imports beyond Luxon and types). The five spaced-repetition intervals are `INTERVALS = [1, 3, 7, 14, 30]` days. `repetitionIndex` is 0-based (max 4). `isDueToday` returns true when `task.nextDueDate <= todayLocal` AND `task.lastCompletedDate !== todayLocal` (idempotency guard lives in the DB layer too).

### Database

`packages/db/src/migrations.ts` embeds SQL as plain strings — no `.sql` files, no migration tool runtime. `runMigrations()` is idempotent and called on every `openDatabase()`. The DB file lives in Electron's `userData` directory (`spacedtask.db` production, `spacedtask-dev.db` dev).

### Renderer state

TanStack Query (`@tanstack/react-query`) manages all server state. The `queryClient` is defined in `apps/renderer/src/hooks/useTasks.ts` and exported for use in `main.tsx`. All mutations invalidate `['tasks']` on success. `useTodayLocal` has `staleTime: 30_000`; all task queries have `staleTime: 0`.

## The better-sqlite3 dual-ABI problem

`better-sqlite3` is a native Node.js addon. Tests run on Node 24 (ABI 137); Electron 31 uses Node 20 internally (ABI 125). **Two prebuilt binaries are kept on disk:**

```
node_modules/better-sqlite3/build/Release/
  better_sqlite3.node          ← active binary (whichever ABI is current)
  better_sqlite3.node.node137  ← Node 24 build (for npm test)
  better_sqlite3.node.e125     ← Electron 31 build (for npm start)
```

`scripts/sqlite-swap.js` swaps the active binary using three-way renames (OneDrive blocks `unlink` on `.node` files but allows `rename`). `npm test` calls `rebuild:node` first; `npm start` calls `rebuild:electron` first.

If you ever need to repopulate these caches (e.g. after `npm install` overwrites them):
- **Node 24 build**: The prebuilt tarball is downloaded from GitHub releases and extracted manually (see `scripts/sqlite-swap.js` bootstrap logic).
- **Electron build**: `cd apps/main && npx @electron/rebuild -f -w better-sqlite3`

## Electron launch gotcha

Claude Code's shell sets `ELECTRON_RUN_AS_NODE=1`, which makes the Electron binary behave as a plain Node.js process (no `app`, no `BrowserWindow`). Electron checks for the **existence** of this key (not just its value), so `cross-env ELECTRON_RUN_AS_NODE=` (empty string) still triggers Node mode on Windows. `npm start` uses `scripts/start.js` which calls `delete process.env.ELECTRON_RUN_AS_NODE` before spawning Electron — this is the only reliable fix.

If launching Electron manually from a terminal, always run `unset ELECTRON_RUN_AS_NODE` first.
