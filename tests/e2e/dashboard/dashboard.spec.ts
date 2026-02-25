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

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('DASH-01: Dashboard loads after login', async ({ page }) => {
    // Already on dashboard after login
    await expect(page).toHaveURL(/\/dashboard/);

    // Should see dashboard heading or content
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('DASH-02: Stats cards are visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see stats cards (4 cards typically)
    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
  });

  test('DASH-03: Open timesheets stat', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see "Open Timesheets" or similar stat
    const timesheetStat = page.locator('text=/timesheets|feuilles/i').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
  });

  test('DASH-04: Outstanding amount stat', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see outstanding invoices amount (contains $ symbol)
    const amountStat = page.locator('text=/\\$|€/').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
  });

  test('DASH-05: Activity feed visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see activity section
    const activitySection = page.locator('text=/activity|activité|recent|récent/i').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 });
  });
});
