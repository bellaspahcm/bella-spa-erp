/**
 * E2E Tests - Partner Registration Flow
 * 
 * Test registration → verify → approve → activate
 */

import { test, expect } from '@playwright/test';

test.describe('Partner Registration E2E', () => {
  const testEmail = `test-${Date.now()}@example.com`;

  test('Complete registration flow', async ({ page }) => {
    // 1. Register
    await page.goto('/partner/register');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="phone"]', '0901234567');
    await page.click('input[value="individual"]');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Đăng ký thành công')).toBeVisible();

    // 2. Admin login
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    // 3. View applications
    await page.goto('/admin/partner-applications');
    await page.fill('input[placeholder*="Search"]', testEmail);

    await expect(page.locator(`text=${testEmail}`)).toBeVisible();

    // 4. Approve
    await page.click(`text=${testEmail}`);
    await page.click('button:has-text("Approve")');
    await expect(page.locator('text=Approved')).toBeVisible();
  });

  test('Batch approve multiple applications', async ({ page }) => {
    await page.goto('/admin/partner-applications');

    // Select multiple checkboxes
    await page.click('input[type="checkbox"]', { clickCount: 3 });

    // Batch approve
    await page.click('button:has-text("Approve All")');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=Success')).toBeVisible();
  });
});
