import { test, expect } from '@playwright/test';

// Test credentials - using existing admin user
const TEST_EMAIL = 'dev@xperr.win';
const TEST_PASSWORD = '123456';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test('AUTH-01: Login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Verify login page loaded
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Enter credentials
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('AUTH-02: Login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Enter invalid credentials
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', 'wrongpassword123');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error, stay on login page
    await expect(page.locator('[role="alert"], .text-destructive, [data-testid="login-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-03: Session persistence', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Refresh page
    await page.reload();

    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('AUTH-04: Logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Click the user avatar button in the header (rounded button with initials)
    const userMenuButton = page.locator('button.rounded-full').first();
    await userMenuButton.click();

    // Wait for dropdown menu to appear and click logout
    // French: "Déconnexion", English: "Sign Out"
    const logoutBtn = page.locator('button:has-text("Déconnexion"), button:has-text("Sign Out")').first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-05: Protected route without auth', async ({ page }) => {
    // Try to access dashboard directly without login
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
