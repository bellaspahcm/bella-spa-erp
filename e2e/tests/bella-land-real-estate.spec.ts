/**
 * BELLA LAND — REAL ESTATE E2E SMOKE TEST
 *
 * Browser-level validation of Bella Land / Real Estate UI pages.
 * Tests page rendering, navigation, and basic functionality.
 *
 * Prerequisites:
 * - Development server running (npm run dev)
 * - Test tenant with real_estate_projects and products
 * - Authenticated user session
 *
 * @see docs/architecture/BELLA_LAND_E2E_VALIDATION.md
 */

import { canAuthenticateAdminPage, expect, test } from '../fixtures/auth';

test.describe('BELLA LAND — Real Estate UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if authentication is not available
    if (!canAuthenticateAdminPage()) {
      test.skip();
    }
  });

  test('Real Estate Dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the right page
    await expect(page).toHaveURL(/\/dashboard\/real-estate/);
    
    // Verify Real Estate Dashboard UI contract - key business sections must be visible
    // These assertions verify the page rendered successfully with actual Real Estate content
    await expect(page.getByText(/hệ thống quản lý bất động sản/i)).toBeVisible();
    await expect(page.getByText(/tổng doanh thu/i)).toBeVisible();
    await expect(page.getByText(/dự án bất động sản/i)).toBeVisible();
    
    // Verify no application errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Projects page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/projects');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/projects/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Apartments page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/apartments');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/apartments/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Contracts page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/contracts');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/contracts/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Customers page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/customers');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/customers/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Support page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/support');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/support/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Documents page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/documents');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/documents/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Reports page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/reports');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/reports/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('BI Analytics page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/bi-analytics');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/bi-analytics/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Global Search page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/global-search');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/global-search/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('HR page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/hr');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/hr/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Leads page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/leads');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/leads/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Marketing page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/marketing');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/marketing/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Org Chart page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/org-chart');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/org-chart/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('People page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/people');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/people/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });

  test('Admin page loads', async ({ page }) => {
    await page.goto('/dashboard/real-estate/admin');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/dashboard\/real-estate\/admin/);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
  });
});

test.describe('BELLA LAND — Product Layer Integration', () => {
  test.beforeEach(async ({ page }) => {
    if (!canAuthenticateAdminPage()) {
      test.skip();
    }
  });

  test('Dashboard uses Bella Land Product Server Action', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard/real-estate');
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    await expect(page).toHaveURL(/\/dashboard\/real-estate/);
    
    // Verify Real Estate Dashboard UI contract - Business semantics validation
    await expect(page.getByText(/hệ thống quản lý bất động sản/i)).toBeVisible();
    await expect(page.getByText(/dự án bất động sản/i)).toBeVisible();
    
    // Verify no application errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/application error/i);
    
    // Verify projects are loaded (Product Server Action validation)
    // Check that the project section is visible and has content
    await expect(page.locator('text=Vinhomes Green Paradise')).toBeVisible();
  });
});
