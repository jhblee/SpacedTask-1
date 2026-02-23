# SpacedTask

A production-ready, cross-platform spaced-repetition desktop app built with
**Electron + React + TypeScript + SQLite**.

---

## Milestones

| Phase             | Scope                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| 1 — Scaffold      | Monorepo structure, root config, TypeScript, ESLint, Prettier                           |
| 2 — Core logic    | `packages/shared` (types, Zod schemas, pure scheduling functions + unit tests)          |
| 3 — DB layer      | `packages/db` (better-sqlite3, embedded migrations, typed query functions + unit tests) |
| 4 — Electron main | `apps/main` (BrowserWindow, CSP, preload/contextBridge, IPC handlers)                   |
| 5 — React UI      | `apps/renderer` (React 18, TanStack Query, all components, CSS)                         |
| 6 — Packaging     | electron-builder config, icon placeholders, GitHub Actions CI                           |

---

## Repository Structure

```
SpacedTask-1/
├── .github/workflows/ci.yml        ← CI: lint → test → build installers on tags
├── apps/
│   ├── main/                       ← Electron main process
│   │   └── src/
│   │       ├── index.ts            ← BrowserWindow, CSP, lifecycle
│   │       ├── preload.ts          ← contextBridge (narrow IPC API)
│   │       ├── logger.ts           ← electron-log wrapper
│   │       └── ipc/handlers.ts     ← ipcMain.handle registrations
│   └── renderer/                   ← React UI (Vite)
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx            ← React root + QueryClientProvider
│           ├── App.tsx             ← Layout
│           ├── components/
│           │   ├── AddTaskForm.tsx
│           │   ├── TodayList.tsx
│           │   ├── TaskItem.tsx    ← checkbox, reset, delete, meta display
│           │   ├── AllTasks.tsx    ← search + sort
│           │   └── Toast.tsx       ← toast notifications
│           ├── hooks/useTasks.ts   ← TanStack Query hooks
│           ├── lib/ipc.ts          ← typed IPC client (wraps window.electronAPI)
│           └── styles/global.css
├── packages/
│   ├── shared/                     ← Pure types, Zod schemas, scheduling logic
│   │   └── src/
│   │       ├── types.ts
│   │       ├── schemas.ts
│   │       ├── scheduling.ts
│   │       └── __tests__/scheduling.test.ts
│   └── db/                         ← SQLite layer
│       └── src/
│           ├── index.ts            ← openDatabase()
│           ├── migrations.ts       ← embedded SQL migrations
│           ├── queries.ts          ← getAllTasks, createTask, completeTask, resetTask, deleteTask
│           └── __tests__/queries.test.ts
├── tests/e2e/app.spec.ts           ← Playwright E2E
├── build/icons/                    ← App icon placeholders
├── electron-builder.yml
├── playwright.config.ts
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
└── pnpm-workspace.yaml
```

---

## Development Setup

### Prerequisites

- **Node.js** >= 20 LTS
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Python** + build tools (for `better-sqlite3` native compilation):
  - **Windows:** `npm install -g windows-build-tools` or install VS Build Tools
  - **macOS:** `xcode-select --install`
  - **Linux:** `sudo apt install build-essential`

### Install

```bash
pnpm install
```

> `apps/main` has a `postinstall` script that runs `@electron/rebuild` to
> compile `better-sqlite3` for your Electron version automatically.

### Build all packages

```bash
pnpm build
```

This compiles `packages/shared` → `packages/db` → `apps/main` (TypeScript),
then bundles `apps/renderer` with Vite.

### Start in development mode

In two terminals:

```bash
# Terminal 1 — Vite dev server (renderer hot-reload)
cd apps/renderer && pnpm dev

# Terminal 2 — Electron (watches compiled main)
cd apps/main && pnpm dev
```

---

## Testing

### Unit tests (Vitest)

```bash
pnpm test                 # run all unit tests
pnpm test:coverage        # with coverage report (threshold: 80%)
```

Tests live in:

- `packages/shared/src/__tests__/scheduling.test.ts`
- `packages/db/src/__tests__/queries.test.ts`

### E2E tests (Playwright + Electron)

```bash
# Build first (E2E launches the compiled app)
pnpm build

# Install Playwright browsers (first time only)
npx playwright install

# Run E2E
pnpm test:e2e
```

---

## Lint & Format

```bash
pnpm lint             # ESLint (errors fail CI)
pnpm format           # Prettier write
pnpm format:check     # Prettier check (CI)
```

---

## Building Installers

```bash
pnpm package          # current platform
pnpm package:win      # Windows NSIS (.exe)
pnpm package:mac      # macOS DMG (.dmg)
```

Output goes to `release/`.

### Icons

Place icon files in `build/icons/` before packaging (see `build/icons/README.md`).

### Code Signing

**Windows (Authenticode):**

```bash
export CSC_LINK=/path/to/certificate.pfx     # or base64 string
export CSC_KEY_PASSWORD=your_password
pnpm package:win
```

**macOS (Apple Developer ID + Notarization):**

```bash
export CSC_LINK=/path/to/DeveloperID.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=you@example.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=XXXXXXXXXX
pnpm package:mac
```

---

## CI / CD (GitHub Actions)

The workflow at `.github/workflows/ci.yml`:

| Trigger             | Jobs                                                    |
| ------------------- | ------------------------------------------------------- |
| Push / PR to `main` | `lint-and-test` (Ubuntu, fast)                          |
| Tag `v*.*.*`        | `lint-and-test` → `build-win` + `build-mac` → `release` |

Push a release tag to publish:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Artifacts (`.exe`, `.dmg`) are uploaded to the GitHub Release automatically.

---

## Security Decisions

### contextIsolation: true

The renderer process runs in an isolated JavaScript world. It cannot access
Node.js APIs or `require()` — it only sees `window.electronAPI`, which is
explicitly allow-listed via `contextBridge.exposeInMainWorld`.

### nodeIntegration: false

Disables Node.js in the renderer entirely. Even if a malicious script were
injected via XSS (e.g., from a rogue npm dependency), it cannot read the file
system or execute shell commands.

### sandbox: true

Enables Chromium's OS-level process sandbox for the renderer, restricting
syscalls to the minimum needed to render HTML/CSS/JS.

### Narrow IPC surface

The preload exposes exactly 7 typed functions. Every IPC handler validates its
input with Zod before touching the database. Unknown channels are silently
ignored by Electron.

### Content Security Policy

Applied via `session.defaultSession.webRequest.onHeadersReceived`:

- `default-src 'self'` — no inline scripts, no external resources
- `script-src 'self'` — only scripts from the same origin (bundled by Vite)
- `object-src 'none'` — no plugins
- In production, `'unsafe-inline'` is stripped from `style-src`

### will-navigate guard

Any attempt to navigate the renderer to an external URL is blocked in the
main process, preventing phishing-style redirects.

### Single-instance lock

`app.requestSingleInstanceLock()` prevents multiple app instances from
writing to the same SQLite database concurrently.

---

## Design Decisions

### Why Luxon for dates?

`Date` arithmetic with milliseconds is DST-unsafe. Adding `86400000 ms` on a
spring-forward day can skip a day. Luxon's `DateTime.plus({ days: N })` adds
**calendar days**, producing a correct `YYYY-MM-DD` string regardless of DST.
All dates are stored as `TEXT YYYY-MM-DD` in SQLite — no epoch integers.

### Why embedded migrations instead of drizzle-kit files?

drizzle-kit generates `.sql` files that must be present at runtime. For a
packaged Electron app, resolving the migration folder path across dev/packaged
environments adds fragility. Embedding the SQL in `migrations.ts` is:

- Zero-config at runtime
- Trivially extended (add a new object to the array)
- Idempotent (tracked by `schema_migrations` table)

### Why TanStack Query (React Query)?

Mutations → `invalidateQueries` → instant re-fetch gives a clean
request/response model without manual state threading. The IPC calls behave
like async HTTP endpoints — Query is a natural fit.

### Why pnpm workspaces?

- Strict: packages can only import what they declare in `dependencies`
- Fast: content-addressable store avoids duplicate hoisting
- Native support in modern Node tooling (no lerna needed)

### Why better-sqlite3 over node-sqlite3 / Prisma?

- **Synchronous API** is safe and simple in the main process (no async DB bugs)
- **No ORM overhead** — queries are explicit, readable, and testable
- **Fast** — no JS↔native marshalling overhead vs async drivers
- Prisma and Drizzle Kit add CLI/schema-generation complexity not needed here

### Assumptions made

- **Package manager:** pnpm 9 with workspaces
- **Node version:** 20 LTS
- **Electron version:** 31 (Chromium 126, Node 20)
- **React version:** 18
- **No system tray / notifications** — not in spec; not added
- **No auto-updater** — electron-updater can be added later; not in spec
- **CSS approach:** single global CSS file — no Tailwind/CSS-in-JS, keeps
  bundle small and styling fully inspectable
