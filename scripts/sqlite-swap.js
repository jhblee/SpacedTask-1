/**
 * sqlite-swap.js -- switches the active better-sqlite3 native binary between
 * the Node.js (test) build and the Electron (app) build.
 *
 * Usage:
 *   node scripts/sqlite-swap.js node      -- activate Node.js ABI build
 *   node scripts/sqlite-swap.js electron  -- activate Electron ABI build
 *
 * Binary cache layout (inside node_modules/better-sqlite3/build/Release/):
 *   better_sqlite3.node          <- active binary (loaded at runtime)
 *   better_sqlite3.node.node137  <- Node.js 24 / ABI 137 cache
 *   better_sqlite3.node.e125     <- Electron 31 / ABI 125 cache
 *
 * Why renames instead of delete+write:
 *   OneDrive (Windows) blocks unlinking .node PE files but allows renaming.
 *   Three-way rename atomically swaps the two without any deletion.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const target = process.argv[2];
if (target !== 'node' && target !== 'electron') {
  console.error('Usage: node scripts/sqlite-swap.js <node|electron>');
  process.exit(1);
}

const releaseDir = path.resolve(
  __dirname,
  '../node_modules/better-sqlite3/build/Release'
);
const active  = path.join(releaseDir, 'better_sqlite3.node');
const nodeVer = path.join(releaseDir, 'better_sqlite3.node.node137');
const elecVer = path.join(releaseDir, 'better_sqlite3.node.e125');
const tmpPath = path.join(releaseDir, 'better_sqlite3.node.swapping');

const want      = target === 'node' ? nodeVer : elecVer;
const other     = target === 'node' ? elecVer : nodeVer;
const wantLabel = target === 'node' ? 'Node.js ABI 137' : 'Electron ABI 125';
const NODE_ABI  = process.versions.modules; // e.g. "137" for Node 24

// ── Bootstrap: cache the active binary under the right versioned name ───────
if (fs.existsSync(active)) {
  let activeIsNode = false;
  try { require(active); activeIsNode = true; } catch (_) {}

  if (activeIsNode && !fs.existsSync(nodeVer)) {
    fs.copyFileSync(active, nodeVer);
    console.log(`Cached Node.js ABI ${NODE_ABI} binary → .node137`);
  } else if (!activeIsNode && !fs.existsSync(elecVer)) {
    fs.copyFileSync(active, elecVer);
    console.log('Cached Electron ABI 125 binary → .e125');
  }
}

// ── Check the wanted cache exists ──────────────────────────────────────────
if (!fs.existsSync(want)) {
  if (target === 'electron') {
    console.error(
      `Electron ABI 125 binary not cached (${path.basename(elecVer)} missing).\n` +
      `Run from the project root:  npm run build -w apps/main  (triggers postinstall rebuild)`
    );
  } else {
    console.error(
      `Node.js ABI 137 binary not cached (${path.basename(nodeVer)} missing).\n` +
      `The prebuilt will be downloaded automatically on next npm install.`
    );
  }
  process.exit(1);
}

// ── If active is already the wanted build, nothing to do ───────────────────
if (!fs.existsSync(active)) {
  fs.renameSync(want, active);
  console.log(`Activated ${wantLabel} binary.`);
  process.exit(0);
}

// Peek: if active is already from the wanted ABI, skip
const wantSize  = fs.statSync(want).size;
const activeSize = fs.statSync(active).size;
if (wantSize === activeSize) {
  console.log(`Already on ${wantLabel} binary (sizes match, skipping swap).`);
  process.exit(0);
}

// ── Three-way rename swap (no deletion required) ───────────────────────────
fs.renameSync(active, tmpPath);   // active → tmp
fs.renameSync(want,   active);    // want   → active
fs.renameSync(tmpPath, other);    // tmp    → other (caches old active)

console.log(`Switched to ${wantLabel} binary.`);
