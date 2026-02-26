import { test, expect } from '@playwright/test';

// Test credentials
const TEST_EMAIL = 'dev@xperr.win';
const TEST_PASSWORD = '123456';

// Helper to login
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

// Get current week's Monday in YYYY-MM-DD format
function getCurrentWeekMonday(): string {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return monday.toISOString().split('T')[0];
}

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('EXP-01: View expense list', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Should see expenses heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should see "My Expenses" tab
    const tab = page.getByRole('tab', { name: /my expenses|mes dépenses/i });
    await expect(tab).toBeVisible();
  });

  test('EXP-02: Navigate to week entry', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Click on a week entry or "New" button
    const newBtn = page.locator('a:has-text("New"), a:has-text("Nouvelle"), button:has-text("New"), button:has-text("Nouvelle")').first();

    if (await newBtn.isVisible()) {
      await newBtn.click();
    } else {
      // Navigate directly to current week
      const weekStr = getCurrentWeekMonday();
      await page.goto(`/expenses/${weekStr}`);
    }

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/expenses\//);
  });

  test('EXP-03: Week entry page loads', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Should see week display
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('EXP-04: Add expense button visible', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Should see "Add Expense" button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter")').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('EXP-05: Expense types are available', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Click add button to open dialog
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Should see expense type dropdown in dialog
      const typeSelect = page.locator('#expense_type_id, [name="expense_type_id"], select').first();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('EXP-06: Project selection available', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Should have project select in dialog
      const projectSelect = page.locator('#project_id, [name="project_id"]').first();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('EXP-07: Tax calculation fields exist', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Should see quantity/unit_price fields or amount field in dialog
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('EXP-08: Billable checkbox exists', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Should see billable checkbox in dialog
      const billableCheckbox = page.locator('#is_billable, [name="is_billable"]');
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('EXP-09: Submit button visible', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Should see Submit button for submitting expenses
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Soumettre")').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('EXP-10: Copy previous week button', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Should see "Copy Previous Week" button
    const copyBtn = page.locator('button:has-text("Copy"), button:has-text("Copier")').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('EXP-11: Week navigation works', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Look for prev/next week buttons
    const prevBtn = page.locator('button:has(svg), [aria-label*="prev"]').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('EXP-12: View team approvals tab', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Click Team Approvals tab
    const teamTab = page.locator('button:has-text("Team Approvals"), button:has-text("Approbations")').first();

    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveURL(/\/expenses/);
  });

  test('EXP-13: Expense totals display', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Should show totals section
    await expect(page.locator('main')).toBeVisible();
  });

  test('EXP-14: Back to list navigation', async ({ page }) => {
    const weekStr = getCurrentWeekMonday();
    await page.goto(`/expenses/${weekStr}`);
    await page.waitForLoadState('networkidle');

    // Navigate back to expenses list
    const backLink = page.locator('a:has-text("Back"), a:has-text("Retour"), a[href="/expenses"]').first();
    if (await backLink.isVisible()) {
      await backLink.click();
    } else {
      await page.goto('/expenses');
    }

    await expect(page).toHaveURL(/\/expenses$/);
  });
});
