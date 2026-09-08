/**
 * Absolute minimal Playwright test — no fixtures, no auth, no imports
 * 
 * Purpose: Isolate if Playwright itself works or if ALL tests are broken
 */

import { test, expect } from '@playwright/test';

test('minimal test - no fixtures', async ({ page }) => {
  console.log('[Minimal] Starting test...');
  
  await page.goto('http://localhost:3000');
  console.log('[Minimal] Navigated to home');
  
  const body = page.locator('body');
  await expect(body).toBeVisible();
  
  console.log('[Minimal] ✅ PASS');
});
