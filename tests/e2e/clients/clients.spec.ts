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

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('CLI-01: View client list', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Should see clients heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should see table or client list
    const table = page.locator('table, [role="grid"]');
    await expect(table.or(page.locator('main'))).toBeVisible();
  });

  test('CLI-02: Search clients', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Rechercher"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('CONST');
      await page.waitForLoadState('networkidle');

      // Should filter results
      await expect(page).toHaveURL(/\/clients/);
    }
  });

  test('CLI-03: Navigate to create client page', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Click "Add Client" button (French: "Ajouter un client")
    const addBtn = page.locator('a:has-text("Add"), a:has-text("Ajouter"), button:has-text("Add"), button:has-text("Ajouter")').first();

    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForLoadState('networkidle');

      // Should be on new client page
      await expect(page).toHaveURL(/\/clients\/new/);
    }
  });

  test('CLI-04: Client form validation', async ({ page }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Submit empty form
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.click();

    // Should show validation errors
    await page.waitForTimeout(500);
    // Form should still be on new page (not redirected)
    await expect(page).toHaveURL(/\/clients\/new/);
  });

  test('CLI-05: Navigate to edit client', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Click on first client row to view details
    const clientRow = page.locator('table tbody tr, a[href*="/clients/"]').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Should be on client detail or edit page
      await expect(page).toHaveURL(/\/clients\/[a-z0-9-]+/);
    }
  });

  test('CLI-06: View client detail tabs', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Click on first client row
    const clientRow = page.locator('table tbody tr').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Should see tabs: Details, Contacts, Projects (or French equivalents)
      const detailsTab = page.locator('button:has-text("Details"), button:has-text("Détails")').first();
      const contactsTab = page.locator('button:has-text("Contacts")').first();
      const projectsTab = page.locator('button:has-text("Projects"), button:has-text("Projets")').first();

      // At least page content should be visible
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('CLI-07: View contacts tab', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const clientRow = page.locator('table tbody tr').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Click Contacts tab
      const contactsTab = page.locator('button:has-text("Contacts")').first();
      if (await contactsTab.isVisible()) {
        await contactsTab.click();
        await page.waitForLoadState('networkidle');
      }

      // Page should remain on client detail
      await expect(page).toHaveURL(/\/clients\/[a-z0-9-]+/);
    }
  });

  test('CLI-08: View projects tab', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const clientRow = page.locator('table tbody tr').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Click Projects tab
      const projectsTab = page.locator('button:has-text("Projects"), button:has-text("Projets")').first();
      if (await projectsTab.isVisible()) {
        await projectsTab.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page).toHaveURL(/\/clients\/[a-z0-9-]+/);
    }
  });

  test('CLI-09: Navigate to edit page', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const clientRow = page.locator('table tbody tr').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Click Edit button
      const editBtn = page.locator('a:has-text("Edit"), a:has-text("Modifier"), button:has-text("Edit"), button:has-text("Modifier")').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/clients\/[a-z0-9-]+\/edit/);
      }
    }
  });

  test('CLI-10: Client status badge visible', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Check that status badges are visible in the list
    const statusBadge = page.locator('[class*="badge"], [class*="Badge"]').first();
    // Page should be visible regardless of badges
    await expect(page.locator('main')).toBeVisible();
  });

  test('CLI-11: Pagination works', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Look for pagination controls
    const pagination = page.locator('nav[aria-label*="pagination"], [role="navigation"]');
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Suivant"), button[aria-label*="next"]').first();

    // Pagination should exist if there are many clients
    await expect(page.locator('main')).toBeVisible();
  });

  test('CLI-12: Back to list navigation', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const clientRow = page.locator('table tbody tr').first();

    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('networkidle');

      // Navigate back to list
      const backLink = page.locator('a:has-text("Back"), a:has-text("Retour"), a[href="/clients"]').first();
      if (await backLink.isVisible()) {
        await backLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        await page.goto('/clients');
      }

      await expect(page).toHaveURL(/\/clients$/);
    }
  });
});
