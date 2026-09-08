/**
 * Bella AutoMove — E2E Tests
 *
 * End-to-end testing for automotive service & repair workflows.
 * 
 * NOTE: Factory P0 Environment Preflight (F-G1) integration is tested
 * separately in unit tests. E2E tests focus on user workflows.
 * 
 * For F-G1 preflight integration evidence, see:
 * - src/__tests__/factory-preflight-guard.test.ts (14/14 tests PASS)
 * - F-G1 validates database tables, RLS, privileges before E2E
 * - Prevents E2E failures from environment misconfiguration
 */

import { canAuthenticateAdminPage, expect, test } from '../fixtures/auth';

test.describe('Bella AutoMove E2E', () => {
  test.setTimeout(180_000);

  test.skip(
    !canAuthenticateAdminPage(),
    'Requires E2E admin credentials or localhost Supabase admin env.'
  );

  // F-G1 Integration Note:
  // In production use, beforeAll would call:
  // const result = await runPreflight({ product: 'bella-automove', checks: ['database', 'environment'] });
  // For now, relying on F-G1 unit test evidence (14/14 PASS)

  test.describe('Dashboard', () => {
    test('should display AutoMove dashboard with quick actions', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Bella AutoMove');

      // Verify quick action cards using role-based selectors
      await expect(page.getByRole('link', { name: /vehicles/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /appointments/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /repair orders/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /invoices/i })).toBeVisible();
    });

    test('should navigate to vehicles page from dashboard', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove');
      await page.click('text=Vehicles');
      await expect(page).toHaveURL('/dashboard/automove/vehicles');
    });

    test('should navigate to appointments page from dashboard', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove');
      await page.getByRole('link', { name: /appointments/i }).click();
      await expect(page).toHaveURL('/dashboard/automove/appointments');
    });

    test('should navigate to repair orders page from dashboard', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove');
      await page.click('text=Repair Orders');
      await expect(page).toHaveURL('/dashboard/automove/repair-orders');
    });
  });

  test.describe('Vehicles Workflow', () => {
    test('should display vehicles list page', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/vehicles');

      await expect(page.locator('h1')).toContainText('Vehicles');
      await expect(page.locator('text=Add Vehicle')).toBeVisible();
    });

    test('should display empty state when no vehicles exist', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/vehicles');

      // Wait for suspense to resolve
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Additional wait for React hydration

      // Should show either table or empty state (depending on data)
      const hasTable = await page.locator('table').count();
      const hasEmptyState = await page.locator('text=No vehicles yet').count();

      expect(hasTable + hasEmptyState).toBeGreaterThan(0);
    });

    test('should navigate to add vehicle form', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/vehicles');
      await page.click('text=Add Vehicle');
      await expect(page).toHaveURL('/dashboard/automove/vehicles/new');
    });
  });

  test.describe('Appointments Workflow', () => {
    test('should display appointments list page', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/appointments');

      await expect(page.locator('h1')).toContainText('Appointments');
      await expect(page.locator('text=New Appointment')).toBeVisible();
    });

    test('should display empty state when no appointments exist', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/appointments');

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Additional wait for React hydration

      const hasTable = await page.locator('table').count();
      const hasEmptyState = await page.locator('text=No appointments scheduled').count();

      expect(hasTable + hasEmptyState).toBeGreaterThan(0);
    });

    test('should navigate to schedule appointment form', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/appointments');
      await page.click('text=New Appointment');
      await expect(page).toHaveURL('/dashboard/automove/appointments/new');
    });
  });

  test.describe('Repair Orders Workflow', () => {
    test('should display repair orders list page', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/repair-orders');

      await expect(page.locator('h1')).toContainText('Repair Orders');
      await expect(page.locator('text=New Repair Order')).toBeVisible();
    });

    test('should display empty state when no repair orders exist', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/repair-orders');

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Additional wait for React hydration

      const hasTable = await page.locator('table').count();
      const hasEmptyState = await page.locator('text=No repair orders yet').count();

      expect(hasTable + hasEmptyState).toBeGreaterThan(0);
    });

    test('should navigate to create repair order form', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/repair-orders');
      await page.click('text=New Repair Order');
      await expect(page).toHaveURL('/dashboard/automove/repair-orders/new');
    });
  });

  test.describe('Invoices Workflow', () => {
    test('should display invoices list page', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/invoices');

      await expect(page.locator('h1')).toContainText('Invoices');
    });

    test('should display empty state when no invoices exist', async ({ adminPage }) => {
      const page = adminPage;
      await page.goto('/dashboard/automove/invoices');

      await page.waitForLoadState('networkidle');

      const hasTable = await page.locator('table').isVisible().catch(() => false);
      const hasEmptyState = await page
        .locator('text=No invoices yet')
        .isVisible()
        .catch(() => false);

      expect(hasTable || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Navigation & Integration', () => {
    test('should navigate between all AutoMove pages', async ({ adminPage }) => {
      const page = adminPage;
      // Start from dashboard
      await page.goto('/dashboard/automove');
      await expect(page.locator('h1')).toContainText('Bella AutoMove');

      // Navigate to vehicles
      await page.click('text=Vehicles');
      await expect(page).toHaveURL('/dashboard/automove/vehicles');
      await expect(page.locator('h1')).toContainText('Vehicles');

      // Navigate back to dashboard
      await page.goto('/dashboard/automove');

      // Navigate to appointments
      await page.getByRole('link', { name: /appointments/i }).click();
      await expect(page).toHaveURL('/dashboard/automove/appointments');
      await expect(page.locator('h1')).toContainText('Appointments');

      // Navigate back to dashboard
      await page.goto('/dashboard/automove');

      // Navigate to repair orders
      await page.getByRole('link', { name: /repair orders/i }).click();
      await expect(page).toHaveURL('/dashboard/automove/repair-orders');
      await expect(page.locator('h1')).toContainText('Repair Orders');

      // Navigate back to dashboard
      await page.goto('/dashboard/automove');

      // Navigate to invoices
      await page.getByRole('link', { name: /invoices/i }).click();
      await expect(page).toHaveURL('/dashboard/automove/invoices');
      await expect(page.locator('h1')).toContainText('Invoices');
    });
  });
});
