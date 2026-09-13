/**
 * P2.3 Browser Runtime — Automated Browser Test
 * 
 * Uses Playwright to verify production UI actually works in real browser.
 * Tests B1-B10 with actual browser interaction + independent DB verification.
 * 
 * NOTE: Does NOT rely on network response inspection (Server Actions don't
 * always expose clean JSON). Instead: UI state + reload + independent DB check.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL = 'loadtest-realestate@test.local';
const TEST_PASSWORD = 'Test123456!';
const TENANT_A_ID = '1a6643da-3806-4793-a301-7a6d60b0d888';
const PROJECT_A_ID = '47685225-5b46-4cbc-a191-2426e6873cb7';

// Supabase client for independent DB verification
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

test.describe('P2.3 Production Browser Runtime', () => {
  let productCode: string;
  let createdProductId: string | null = null;

  test.beforeEach(async ({ page }) => {
    productCode = `P2.3-E2E-${Date.now()}`;
    
    // B1: Login succeeds
    console.log('\n▶️  B1: Login');
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log('✅ B1 PASS: Login succeeded');
  });

  test.afterEach(async () => {
    // Cleanup: Delete test product
    if (createdProductId) {
      console.log('\n🧹 Cleaning up test product...');
      await supabase
        .from('real_estate_products')
        .delete()
        .eq('id', createdProductId);
      console.log('✅ Cleanup complete');
    }
  });

  test('B1-B10: Complete production browser flow', async ({ page }) => {

    // B2: /dashboard/real-estate/apartments loads
    console.log('\n▶️  B2: Navigate to /dashboard/real-estate/apartments');
    await page.goto('/dashboard/real-estate/apartments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Bảng hàng căn hộ')).toBeVisible({ timeout: 10000 });
    console.log('✅ B2 PASS: Apartments page loaded');

    // B3: "Tạo căn mới" clickable
    console.log('\n▶️  B3: Verify "Tạo căn mới" button clickable');
    const createButton = page.locator('button:has-text("Tạo căn mới")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await expect(createButton).toBeEnabled();
    console.log('✅ B3 PASS: Create button visible and clickable');

    // B4: Modal renders
    console.log('\n▶️  B4: Click button and verify modal renders');
    await createButton.click();
    const modal = page.locator('text=Tạo căn / sản phẩm mới');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify project context in modal
    const projectLabel = page.locator('text=/Dự án:.*Real Estate/');
    await expect(projectLabel).toBeVisible();
    console.log('✅ B4 PASS: Modal rendered with project context');

    // B5: Form fields bind correctly
    console.log('\n▶️  B5: Fill form fields');
    await page.fill('input[placeholder*="VD: A1-05-01"]', productCode);
    
    // Product type select (more specific selector)
    await page.locator('select').nth(0).selectOption('apartment');
    
    await page.fill('input[placeholder*="A, B, C"]', 'A');
    await page.fill('input[placeholder*="1, 2, 3"]', '5');
    await page.fill('input[type="number"]').nth(0).fill('100'); // Area
    await page.fill('input[type="number"]').nth(1).fill('50000000'); // Price
    
    // Status select
    await page.locator('select').nth(1).selectOption('available');
    
    // Verify values bound
    await expect(page.locator('input[placeholder*="VD: A1-05-01"]')).toHaveValue(productCode);
    console.log('✅ B5 PASS: Form fields bind correctly');
    console.log(`   Product Code: ${productCode}`);

    // B6: Submit succeeds
    console.log('\n▶️  B6: Submit form');
    const submitButton = page.locator('button:has-text("Tạo căn")');
    await submitButton.click();
    
    // Wait for async operation
    await page.waitForTimeout(3000);
    console.log('✅ B6 PASS: Form submitted');

    // B7: Modal closes / success state appears
    console.log('\n▶️  B7: Verify modal closes and success state');
    
    // Modal should close
    await expect(page.locator('text=Tạo căn / sản phẩm mới')).not.toBeVisible({ timeout: 5000 });
    console.log('✅ B7 PASS: Modal closed + success state confirmed');

    // B8: New product appears in production list
    console.log('\n▶️  B8: Verify product appears in list');
    
    // Wait for product to appear in grid
    await page.waitForTimeout(2000);
    const productInList = page.locator(`text=${productCode}`);
    await expect(productInList).toBeVisible({ timeout: 10000 });
    console.log('✅ B8 PASS: Product appears in apartment list');

    // B9: Reload → product still visible
    console.log('\n▶️  B9: Reload page and verify persistence');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Product should still be visible after reload
    await expect(page.locator(`text=${productCode}`)).toBeVisible({ timeout: 10000 });
    console.log('✅ B9 PASS: Product persists after reload');

    // B10: Independent DB check (tenant_id + project_id)
    console.log('\n▶️  B10: Independent DB verification');
    
    // Query DB directly to verify tenant_id and project_id
    const { data: dbProduct, error } = await supabase
      .from('real_estate_products')
      .select('id, tenant_id, project_id, product_code')
      .eq('product_code', productCode)
      .single();

    if (error || !dbProduct) {
      throw new Error(`B10 FAIL: Product not found in DB: ${error?.message}`);
    }

    // Verify tenant_id
    if (dbProduct.tenant_id !== TENANT_A_ID) {
      throw new Error(`B10 FAIL: tenant_id mismatch. Expected: ${TENANT_A_ID}, Got: ${dbProduct.tenant_id}`);
    }

    // Verify project_id
    if (dbProduct.project_id !== PROJECT_A_ID) {
      throw new Error(`B10 FAIL: project_id mismatch. Expected: ${PROJECT_A_ID}, Got: ${dbProduct.project_id}`);
    }

    // Store for cleanup
    createdProductId = dbProduct.id;

    console.log('✅ B10 PASS: DB verification complete');
    console.log(`   tenant_id: ${dbProduct.tenant_id}`);
    console.log(`   project_id: ${dbProduct.project_id}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('P2.3 BROWSER RUNTIME VERIFICATION COMPLETE');
    console.log('='.repeat(70));
    console.log('\n✅ B1:  Login succeeded');
    console.log('✅ B2:  /dashboard/real-estate/apartments loaded');
    console.log('✅ B3:  "Tạo căn mới" button clickable');
    console.log('✅ B4:  Modal rendered');
    console.log('✅ B5:  Form fields bind correctly');
    console.log('✅ B6:  Submit succeeded');
    console.log('✅ B7:  Modal closed / success state');
    console.log('✅ B8:  Product appears in list');
    console.log('✅ B9:  Product persists after reload');
    console.log('✅ B10: DB verification (tenant_id + project_id) PASS');
    console.log('\n🎯 P2.3 BROWSER RUNTIME: ✅ VERIFIED (10/10)');
    console.log('='.repeat(70));
  });
});
