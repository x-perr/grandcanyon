import { test as base, expect, Page } from '@playwright/test';

// Test user credentials - use existing admin user
const TEST_ADMIN = {
  email: 'dev@xperr.win',
  password: process.env.TEST_PASSWORD || 'testpass123',
};

// Extended test with auth utilities
export const test = base.extend<{
  authenticatedPage: Page;
  login: (page: Page, email?: string, password?: string) => Promise<void>;
}>({
  login: async ({}, use) => {
    const loginFn = async (page: Page, email = TEST_ADMIN.email, password = TEST_ADMIN.password) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    };
    await use(loginFn);
  },

  authenticatedPage: async ({ page, login }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };

// Helper functions
export async function logout(page: Page) {
  // Click user menu and logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-btn"]');
  await page.waitForURL('**/login');
}

export async function waitForToast(page: Page, text?: string) {
  const toast = page.locator('[data-sonner-toast]');
  await expect(toast).toBeVisible();
  if (text) {
    await expect(toast).toContainText(text);
  }
}
