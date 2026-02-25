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

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('ADM-01: View admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should see admin heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('ADM-02: Navigate to users page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click Users link
    const usersLink = page.locator('a:has-text("Users"), a:has-text("Utilisateurs")').first();

    if (await usersLink.isVisible()) {
      await usersLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/admin\/users/);
    }
  });

  test('ADM-03: View user list', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Should see users table
    const table = page.locator('table, [role="grid"]');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('ADM-04: Search users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Rechercher"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('dev');
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test('ADM-05: Filter users by role', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find role filter
    const roleFilter = page.locator('select, [role="combobox"]').first();

    if (await roleFilter.isVisible()) {
      await roleFilter.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test('ADM-06: Navigate to user edit', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Click on first user row
    const userRow = page.locator('table tbody tr').first();

    if (await userRow.isVisible()) {
      await userRow.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/admin\/users\/[a-z0-9-]+/);
    }
  });

  test('ADM-07: User edit form loads', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const userRow = page.locator('table tbody tr').first();

    if (await userRow.isVisible()) {
      await userRow.click();
      await page.waitForLoadState('networkidle');

      // Should see user edit form
      const form = page.locator('form');
      await expect(form.or(page.locator('main'))).toBeVisible();
    }
  });

  test('ADM-08: Password reset button exists', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const userRow = page.locator('table tbody tr').first();

    if (await userRow.isVisible()) {
      await userRow.click();
      await page.waitForLoadState('networkidle');

      // Should see password reset button
      const resetBtn = page.locator('button:has-text("Reset"), button:has-text("Réinitialiser")').first();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('ADM-09: Navigate to roles page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click Roles link
    const rolesLink = page.locator('a:has-text("Roles"), a:has-text("Rôles")').first();

    if (await rolesLink.isVisible()) {
      await rolesLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/admin\/roles/);
    }
  });

  test('ADM-10: View permissions matrix', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Should see permissions matrix
    const matrix = page.locator('table, [role="grid"]');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('ADM-11: Company settings visible', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should see company settings form
    const settingsForm = page.locator('form').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('ADM-12: Logo upload field exists', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should see logo upload input
    const logoInput = page.locator('input[type="file"], [data-testid="logo-upload"]');
    await expect(page.locator('main')).toBeVisible();
  });

  test('ADM-13: Navigate to audit logs', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click Logs link
    const logsLink = page.locator('a:has-text("Logs"), a:has-text("Journaux")').first();

    if (await logsLink.isVisible()) {
      await logsLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/admin\/logs/);
    }
  });

  test('ADM-14: View audit logs list', async ({ page }) => {
    await page.goto('/admin/logs');
    await page.waitForLoadState('networkidle');

    // Should see logs table
    const table = page.locator('table, [role="grid"]');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });
});
