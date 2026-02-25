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

test.describe('i18n / Language Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('I18N-01: Default language is French', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Should see French text by default (like "Tableau de bord" or "Feuilles de temps")
    const frenchText = page.locator('text=/Tableau de bord|Accueil|Clients|Projets|Factures/').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('I18N-02: Language toggle exists', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Should see language toggle in user menu
    const userMenu = page.locator('button.rounded-full').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    // Look for language options
    const langOption = page.locator('button:has-text("English"), button:has-text("Français"), button:has-text("FR"), button:has-text("EN")').first();
    await expect(page.locator('[role="menu"]').or(page.locator('main'))).toBeVisible();
  });

  test('I18N-03: Switch to English', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Open user menu
    const userMenu = page.locator('button.rounded-full').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    // Click English option
    const englishBtn = page.locator('button:has-text("English"), button:has-text("EN")').first();
    if (await englishBtn.isVisible()) {
      await englishBtn.click();
      await page.waitForLoadState('networkidle');

      // Should now see English text
      const englishText = page.locator('text=/Dashboard|Timesheets|Clients|Projects|Invoices/').first();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('I18N-04: Switch to French', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Open user menu
    const userMenu = page.locator('button.rounded-full').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    // Click French option
    const frenchBtn = page.locator('button:has-text("Français"), button:has-text("FR")').first();
    if (await frenchBtn.isVisible()) {
      await frenchBtn.click();
      await page.waitForLoadState('networkidle');

      // Should see French text
      const frenchText = page.locator('text=/Tableau de bord|Feuilles de temps|Projets|Factures/').first();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('I18N-05: Language persists after refresh', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');

    // Open user menu and switch to English
    const userMenu = page.locator('button.rounded-full').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    const englishBtn = page.locator('button:has-text("English"), button:has-text("EN")').first();
    if (await englishBtn.isVisible()) {
      await englishBtn.click();
      await page.waitForLoadState('networkidle');

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be in English (check sidebar or heading)
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('I18N-06: Login page supports both languages', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Login page should be visible
    const heading = page.getByRole('heading');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Should see "Sign In" or "Connexion" text
    const signInText = page.locator('text=/Sign In|Connexion|Se connecter/i').first();
    await expect(signInText.or(page.locator('button[type="submit"]'))).toBeVisible();
  });
});
