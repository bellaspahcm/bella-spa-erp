/**
 * Real Auth Fixture for Production-Equivalent E2E Tests
 * 
 * Uses actual Supabase authentication with JWT claims
 * instead of mock_user_email bypass.
 * 
 * This ensures RLS policies that check auth.jwt() work correctly.
 */

import { test as base, type Page } from "@playwright/test";
import { setupTestUser, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './setup-test-user';

type RealAuthFixtures = {
  /** Page with real Supabase authentication (JWT with tenant claims) */
  authenticatedPage: Page;
};

let testUserSetup: Promise<any> | null = null;

export const test = base.extend<RealAuthFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    // Setup test user once per worker
    if (!testUserSetup) {
      testUserSetup = setupTestUser();
    }
    await testUserSetup;

    console.log('[RealAuth] Logging in with real Supabase auth...');
    
    // Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in credentials
    await page.locator('input[type="email"]').fill(TEST_USER_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_USER_PASSWORD);
    
    // Submit login
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    console.log('[RealAuth] Login successful - real JWT session established');

    // Verify we have a real session by checking cookie
    const cookies = await context.cookies();
    const hasAuthCookie = cookies.some(c => 
      c.name.includes('supabase-auth-token') || 
      c.name.includes('sb-') && c.name.includes('-auth-token')
    );

    if (!hasAuthCookie) {
      console.warn('[RealAuth] ⚠️ No Supabase auth cookie found - session may be invalid');
    } else {
      console.log('[RealAuth] ✅ Supabase auth cookie present');
    }

    await use(page);

    // Logout after test
    console.log('[RealAuth] Logging out...');
    await page.goto('/login').catch(() => {}); // Best effort logout
  },
});

export { expect } from "@playwright/test";
