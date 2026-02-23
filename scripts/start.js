/**
 * start.js -- launches the Electron app with a clean environment.
 *
 * cross-env ELECTRON_RUN_AS_NODE= only sets the variable to an empty string;
 * Electron checks for key *existence* (getenv != nullptr), so it still enters
 * Node mode even with an empty value.  Deleting the key from process.env and
 * passing the cleaned env object to spawnSync is the only reliable cross-
 * platform fix.
 */

'use strict';
const { spawnSync } = require('child_process');
const electronPath  = require('electron'); // npm package returns path to binary

// Remove the variable entirely so Electron runs as a GUI app.
delete process.env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(
  electronPath,
  ['.'],                   // '.' resolves via apps/main/package.json "main" field
  {
    cwd: require('path').resolve(__dirname, '../apps/main'),
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  }
);

process.exit(result.status ?? 0);
