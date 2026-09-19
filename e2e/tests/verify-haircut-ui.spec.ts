/**
 * Haircut Shop UI Identity Verification
 * 
 * Browser verification of Product Identity fixes:
 * - Sidebar brand/user display
 * - Dashboard greeting
 * - No cross-vertical leaks
 */

import { test, expect } from '@playwright/test';

// Haircut Shop tenant credentials (E2E database)
// From supabase/seed_haircut_shop.sql
const HAIRCUT_TENANT_EMAIL = 'admin@haircutshop.test';
const HAIRCUT_TENANT_PASSWORD = 'HaircutAdmin@2026';

test.describe('Haircut Shop Product Identity', () => {
  test.beforeEach(async ({ page, context }) => {
    // Use mock_user_email cookie (localhost E2E auth pattern)
    await context.addCookies([
      {
        name: 'mock_user_email',
        value: HAIRCUT_TENANT_EMAIL,
        url: 'http://localhost:3000',
        sameSite: 'Lax',
      },
    ]);
    
    // Navigate directly to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Sidebar should display correct branding (not Spa ERP)', async ({ page }) => {
    // Check sidebar brand text
    const sidebarBrand = await page.locator('aside h2, aside .beauty-erp-brand-script').first();
    const brandText = await sidebarBrand.textContent();
    
    console.log('Sidebar brand:', brandText);
    
    // Should NOT show fallback leaks
    expect(brandText).not.toContain('Spa ERP');
    expect(brandText).not.toContain('Bella Spa');
    
    // Should show Haircut Shop or valid custom branding
    // (Exact match depends on tenant branding configuration)
    expect(brandText).toBeTruthy();
  });

  test('Sidebar should show real user name (not Admin Preschool)', async ({ page }) => {
    // Check sidebar user profile
    const userName = await page.locator('aside .beauty-erp-profile-name, aside p:has-text("Admin")').first();
    const userText = await userName.textContent();
    
    console.log('Sidebar user:', userText);
    
    // Should NOT show fallback leak
    expect(userText).not.toBe('Admin Preschool');
    
    // Should show real user name or neutral fallback
    expect(userText).toBeTruthy();
  });

  test('Dashboard should show Bella Haircut Shop greeting', async ({ page }) => {
    // Check dashboard greeting text
    const greeting = await page.locator('text=/Chào buổi/').first();
    const greetingText = await greeting.textContent();
    
    console.log('Dashboard greeting:', greetingText);
    
    // Should contain product name from UserProvider
    expect(greetingText).toContain('Bella Haircut Shop');
    
    // Should NOT contain fallback leaks
    expect(greetingText).not.toContain('Bella Spa admin');
    expect(greetingText).not.toContain('Spa ERP');
  });

  test('Should not have cross-vertical identity leaks', async ({ page }) => {
    // Get all visible text on page
    const pageText = await page.locator('body').textContent();
    
    console.log('Checking for identity leaks...');
    
    // Should NOT contain wrong vertical identities in visible UI
    const hasSpaSpaLeak = pageText?.includes('Bella Spa') && !pageText?.includes('Bella Haircut Shop');
    const hasSpaErpLeak = pageText?.includes('Spa ERP');
    const hasPreschoolLeak = pageText?.includes('Admin Preschool');
    
    if (hasSpaSpaLeak) console.error('LEAK: Found "Bella Spa" without context');
    if (hasSpaErpLeak) console.error('LEAK: Found "Spa ERP"');
    if (hasPreschoolLeak) console.error('LEAK: Found "Admin Preschool"');
    
    expect(hasSpaErpLeak).toBe(false);
    expect(hasPreschoolLeak).toBe(false);
  });

  test('Navigation should work correctly', async ({ page }) => {
    // Verify page loaded without fatal errors
    const hasError = await page.locator('text=/error|not found/i').count();
    expect(hasError).toBe(0);
    
    // Verify sidebar navigation exists
    const dashboardLinks = await page.locator('a[href="/dashboard"]').count();
    expect(dashboardLinks).toBeGreaterThan(0);
    
    console.log('Navigation: OK');
  });
});
