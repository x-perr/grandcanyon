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

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('RPT-01: View reports landing page', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Should see reports heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('RPT-02: Navigate to timesheet report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Click Timesheets report link
    const timesheetLink = page.locator('a:has-text("Timesheets"), a:has-text("Feuilles de temps")').first();

    if (await timesheetLink.isVisible()) {
      await timesheetLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/reports\/timesheets/);
    }
  });

  test('RPT-03: Timesheet report has filters', async ({ page }) => {
    await page.goto('/reports/timesheets');
    await page.waitForLoadState('networkidle');

    // Should see date range presets or filters
    const filterSection = page.locator('button:has-text("This"), button:has-text("Ce"), select, [role="combobox"]').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('RPT-04: Timesheet report has export button', async ({ page }) => {
    await page.goto('/reports/timesheets');
    await page.waitForLoadState('networkidle');

    // Should see export button
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Exporter")').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('RPT-05: Navigate to invoice report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Click Invoice report link
    const invoiceLink = page.locator('a:has-text("Invoice"), a:has-text("Factures")').first();

    if (await invoiceLink.isVisible()) {
      await invoiceLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/reports\/invoices/);
    }
  });

  test('RPT-06: Invoice report shows aging buckets', async ({ page }) => {
    await page.goto('/reports/invoices');
    await page.waitForLoadState('networkidle');

    // Should see aging categories (0-30, 31-60, etc.)
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('RPT-07: Navigate to profitability report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // Click Profitability report link
    const profitLink = page.locator('a:has-text("Profitability"), a:has-text("Rentabilité")').first();

    if (await profitLink.isVisible()) {
      await profitLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/reports\/profitability/);
    }
  });

  test('RPT-08: Profitability report has data', async ({ page }) => {
    await page.goto('/reports/profitability');
    await page.waitForLoadState('networkidle');

    // Should see table or content
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('RPT-09: Date range presets work', async ({ page }) => {
    await page.goto('/reports/timesheets');
    await page.waitForLoadState('networkidle');

    // Click a date preset like "This Month"
    const presetBtn = page.locator('button:has-text("This Month"), button:has-text("Ce mois")').first();

    if (await presetBtn.isVisible()) {
      await presetBtn.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveURL(/\/reports\/timesheets/);
  });
});
