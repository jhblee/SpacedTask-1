import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env['CI'] ? 2 : 0,
  use: {
    // Electron tests use electron.launch() directly in each spec file.
    // No browser-level defaults needed here.
  },
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
});
