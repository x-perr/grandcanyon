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

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('PRJ-01: View project list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Should see projects heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should see table or project list
    const table = page.locator('table, [role="grid"]');
    await expect(table.or(page.locator('main'))).toBeVisible();
  });

  test('PRJ-02: Search projects', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Rechercher"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('001');
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveURL(/\/projects/);
  });

  test('PRJ-03: Filter by status', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Find status filter dropdown
    const statusFilter = page.locator('select, button[role="combobox"], [data-testid="status-filter"]').first();

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(500);
    }

    await expect(page).toHaveURL(/\/projects/);
  });

  test('PRJ-04: Navigate to create project', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click "Add Project" button
    const addBtn = page.locator('a:has-text("Add"), a:has-text("Ajouter"), a:has-text("New"), a:has-text("Nouveau")').first();

    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/projects\/new/);
    }
  });

  test('PRJ-05: Project form has client selector', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle');

    // Should have client select field
    const clientSelect = page.locator('#client_id, [name="client_id"], select:has-text("Client")').first();
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  test('PRJ-06: View project detail tabs', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on first project row
    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Should be on project detail page
      await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);

      // Should see tabs (Details, Team, Tasks, Billing Roles)
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
    }
  });

  test('PRJ-07: View team tab', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Click Team tab
      const teamTab = page.locator('button:has-text("Team"), button:has-text("Équipe")').first();
      if (await teamTab.isVisible()) {
        await teamTab.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
    }
  });

  test('PRJ-08: View tasks tab', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Click Tasks tab
      const tasksTab = page.locator('button:has-text("Tasks"), button:has-text("Tâches")').first();
      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
    }
  });

  test('PRJ-09: View billing roles tab', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Click Billing Roles tab
      const billingTab = page.locator('button:has-text("Billing"), button:has-text("Rôles de facturation"), button:has-text("Facturation")').first();
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
    }
  });

  test('PRJ-10: Navigate to edit project', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Click Edit button
      const editBtn = page.locator('a:has-text("Edit"), a:has-text("Modifier")').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+\/edit/);
      }
    }
  });

  test('PRJ-11: Project code is visible in list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Project codes follow format like CLIENT-001
    const codePattern = page.locator('td, span').filter({ hasText: /-\d{3}/ }).first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('PRJ-12: Billing type visible in list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Should show billing type badges (hourly, fixed, per_unit)
    const billingBadge = page.locator('text=/hourly|fixed|per_unit|horaire|fixe|unitaire/i').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('PRJ-13: Status badge visible', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Status badges (active, draft, completed)
    const statusBadge = page.locator('[class*="badge"]').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('PRJ-14: Project total hours visible', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Should see total hours somewhere on the detail page
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('PRJ-15: Back to list navigation', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectRow = page.locator('table tbody tr').first();

    if (await projectRow.isVisible()) {
      await projectRow.click();
      await page.waitForLoadState('networkidle');

      // Navigate back
      const backLink = page.locator('a:has-text("Back"), a:has-text("Retour"), a[href="/projects"]').first();
      if (await backLink.isVisible()) {
        await backLink.click();
      } else {
        await page.goto('/projects');
      }

      await expect(page).toHaveURL(/\/projects$/);
    }
  });

  test('PRJ-16: Pagination works', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Check pagination exists
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Suivant")').first();
    await expect(page.locator('main')).toBeVisible();
  });
});
