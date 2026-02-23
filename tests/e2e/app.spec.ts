/**
 * E2E tests for SpacedTask using Playwright + Electron.
 *
 * These tests launch the real Electron app against a fresh in-memory (or temp)
 * database, inject a mock date via IPC when needed, and assert UI behaviour.
 *
 * Prerequisites:
 *   - pnpm build  (compile all packages + renderer)
 *   - The main entry is at apps/main/dist/index.js
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAIN_ENTRY = path.resolve(__dirname, '../../apps/main/dist/index.js');

async function launchApp(mockDate?: string): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacedtask-e2e-'));

  const app = await electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      NODE_ENV: 'development', // enables mock-date IPC channel
      ELECTRON_USER_DATA: tmpDir, // isolated DB per test
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Inject mock date if requested
  if (mockDate) {
    await page.evaluate(async (date: string) => {
      await window.electronAPI.setMockDate({ date });
    }, mockDate);
    // Re-fetch today to apply mock
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  }

  return { app, page };
}

async function addTask(page: Page, title: string) {
  await page.getByLabel('New task').fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
  // Wait for optimistic update
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Test: Add task → not due today → not in Today list
// ---------------------------------------------------------------------------
test('newly added task is NOT in Today list on the day it is created', async () => {
  const mockDate = '2024-06-01';
  const { app, page } = await launchApp(mockDate);

  try {
    await addTask(page, 'Study linear algebra');

    // Task should NOT appear in Today's Review Tasks
    // (nextDueDate = 2024-06-02, today = 2024-06-01 → not due)
    const todaySection = page.getByRole('region', { name: /today/i });
    // Should see empty state or the task absent
    await expect(todaySection.getByText('Study linear algebra')).not.toBeVisible({
      timeout: 3000,
    });

    // But it SHOULD appear in All Tasks
    const allSection = page.getByRole('region', { name: /all tasks/i });
    await expect(allSection.getByText('Study linear algebra')).toBeVisible();
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test: Mock date forward → task appears as due
// ---------------------------------------------------------------------------
test('task appears in Today list when date advances to nextDueDate', async () => {
  const creationDate = '2024-06-01';
  const { app, page } = await launchApp(creationDate);

  try {
    await addTask(page, 'Review flashcards');

    // Advance mock date to nextDueDate (2024-06-02)
    await page.evaluate(async () => {
      await window.electronAPI.setMockDate({ date: '2024-06-02' });
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Now the task should appear in Today's Review Tasks
    const todaySection = page.getByRole('region', { name: /today/i });
    await expect(todaySection.getByText('Review flashcards')).toBeVisible();
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test: Check completes → task leaves Today list + no double-advance on reload
// ---------------------------------------------------------------------------
test('completing a task removes it from Today list and does not double-advance on reload', async () => {
  const { app, page } = await launchApp('2024-06-01');

  try {
    await addTask(page, 'Practice problems');

    // Advance to due date
    await page.evaluate(async () => {
      await window.electronAPI.setMockDate({ date: '2024-06-02' });
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const todaySection = page.getByRole('region', { name: /today/i });

    // Find and check the checkbox
    const checkbox = todaySection.getByLabel(/Mark Practice problems as complete/i);
    await checkbox.check();
    await page.waitForTimeout(300);

    // Task should move out of the due list
    await expect(
      todaySection.getByRole('checkbox', { name: /Mark Practice problems/i }),
    ).not.toBeVisible({ timeout: 3000 });

    // Reload — confirm state is preserved (checkbox disabled, not double-advanced)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Completed today section should show it
    const completedSection = page.getByText(/completed today/i);
    await expect(completedSection).toBeVisible();

    // Verify repetitionIndex advanced exactly once by checking step label
    // After completing from index 0 → index 1: "Step 2/5: 3 days"
    await expect(page.getByText('Step 2/5: 3 days')).toBeVisible();
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test: Reset → treated as new task
// ---------------------------------------------------------------------------
test('reset reverts task to step 1 with today as start date', async () => {
  const creationDate = '2024-06-01';
  const { app, page } = await launchApp(creationDate);

  try {
    await addTask(page, 'Deep learning course');

    // Advance and complete twice to move to step 3
    await page.evaluate(async () => {
      await window.electronAPI.setMockDate({ date: '2024-06-02' });
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const todaySection = page.getByRole('region', { name: /today/i });
    await todaySection.getByLabel(/Mark Deep learning/i).check();
    await page.waitForTimeout(300);

    // Advance to next due date after step 1 completion (2024-06-02 + 3 = 2024-06-05)
    await page.evaluate(async () => {
      await window.electronAPI.setMockDate({ date: '2024-06-05' });
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await todaySection.getByLabel(/Mark Deep learning/i).check();
    await page.waitForTimeout(300);

    // Now reset on 2024-06-10
    await page.evaluate(async () => {
      await window.electronAPI.setMockDate({ date: '2024-06-10' });
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Find the task in All Tasks and click Reset
    const allSection = page.getByRole('region', { name: /all tasks/i });
    await allSection.getByRole('button', { name: /Reset Deep learning/i }).click();
    await page.waitForTimeout(300);

    // Should now show Step 1/5 and start date of 2024-06-10
    await expect(page.getByText('Step 1/5: 1 day')).toBeVisible();
    await expect(page.getByText('2024-06-10')).toBeVisible(); // new startDate
  } finally {
    await app.close();
  }
});
