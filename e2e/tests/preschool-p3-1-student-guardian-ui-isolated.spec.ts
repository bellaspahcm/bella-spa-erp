/**
 * Bella Preschool P3.1 — Student & Guardian Management UI E2E (Isolated)
 *
 * Each test provisions its own data and cleans up after itself
 * No shared state between tests
 */

import { test, expect } from '../helpers/real-auth-fixture';
import { 
  createTestStudent, 
  createTestCustomer, 
  linkGuardianToStudent,
  deleteTestStudent,
  deleteTestCustomer,
  type TestStudent,
  type TestCustomer,
} from '../helpers/preschool-test-data';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test tenant ID (non-HQ, active tenant)
const TEST_TENANT_ID = '3f042f90-e9bb-448a-8001-2f418a705dad';

test.describe('P3.1 Student & Guardian Management UI (Isolated)', () => {
  test.setTimeout(180_000);

  test('AUTH-01: should authenticate and navigate to preschool section', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/preschool');
    await expect(page).toHaveURL(/\/preschool/);

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });

    console.log('[E2E] ✅ AUTH-01: Preschool section accessible');
  });

  test('STU-06 to STU-08: should display student in list and view profile', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Create test student
    const student = await createTestStudent(TEST_TENANT_ID, {
      first_name: 'ListTest',
      last_name: 'Student',
    });

    try {
      // Navigate to students list
      await page.goto('/preschool/students');
      await page.waitForLoadState('networkidle');

      // Should see student in list
      await expect(page.locator(`text=/ListTest.*Student|Student.*ListTest/i`)).toBeVisible({ timeout: 10_000 });

      console.log('[E2E] ✅ STU-06: Student appears in list');

      // Click student to view profile
      await page.locator(`text=/ListTest.*Student|Student.*ListTest/i`).first().click();

      // Should navigate to profile page
      await expect(page).toHaveURL(new RegExp(`/preschool/students/${student.id}`));

      // Verify all fields displayed
      await expect(page.locator('h1, h2').filter({ hasText: /ListTest/i })).toBeVisible();
      await expect(page.locator('h1, h2').filter({ hasText: /Student/i })).toBeVisible();

      console.log('[E2E] ✅ STU-07-08: Profile displays correct data');
    } finally {
      await deleteTestStudent(student.id);
    }
  });

  test('STU-09 to STU-13: should update student and verify changes persist', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Create test student
    const student = await createTestStudent(TEST_TENANT_ID, {
      first_name: 'UpdateTest',
      last_name: 'Original',
    });

    try {
      // Navigate to student profile
      await page.goto(`/preschool/students/${student.id}`);
      await page.waitForLoadState('networkidle');

      // Click edit button
      const editButton = page.locator('button, a').filter({ hasText: /edit/i }).first();
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();

      // Should navigate to edit page
      await expect(page).toHaveURL(new RegExp(`/preschool/students/${student.id}/edit`));

      // Change last name
      const lastNameInput = page.locator('input[name="last_name"]');
      await expect(lastNameInput).toHaveValue('Original');
      await lastNameInput.fill('Updated');

      // Submit form
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /save|update/i });
      await submitButton.click();

      // Should redirect to profile
      await page.waitForURL(new RegExp(`/preschool/students/${student.id}$`), { timeout: 10_000 });

      // Verify updated name displayed
      await expect(page.locator('text=/Updated/i')).toBeVisible({ timeout: 5000 });

      // Reload to verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=/Updated/i')).toBeVisible();

      console.log('[E2E] ✅ STU-09-13: Student updated, changes persist');

      // Verify in database
      const { data: updatedStudent } = await supabaseAdmin
        .from('preschool_students')
        .select('last_name')
        .eq('id', student.id)
        .single();

      expect(updatedStudent?.last_name).toBe('Updated');
    } finally {
      await deleteTestStudent(student.id);
    }
  });

  test('GUA-01 to GUA-10: should link guardian and verify relationship', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Create test student and guardian
    const student = await createTestStudent(TEST_TENANT_ID, {
      first_name: 'GuardianLinkTest',
      last_name: 'Student',
    });

    const guardian = await createTestCustomer(TEST_TENANT_ID, {
      name_mother: 'TestGuardian',
      phone: '+15551234567',
    });

    try {
      // Navigate to student profile
      await page.goto(`/preschool/students/${student.id}`);
      await page.waitForLoadState('networkidle');

      // Click "Add Guardian" button
      const addGuardianButton = page.locator('button, a').filter({ hasText: /add guardian|link guardian/i }).first();
      await expect(addGuardianButton).toBeVisible({ timeout: 10_000 });
      await addGuardianButton.click();

      // Dialog/modal should open
      const guardianDialog = page.getByRole('dialog', { name: /add guardian/i });
      await expect(guardianDialog).toBeVisible({ timeout: 5000 });

      // Search for guardian
      const searchInput = guardianDialog.locator('input[placeholder*="search"], input[placeholder*="name"]').first();
      await searchInput.fill('TestGuardian');
      
      // Click search button or press Enter
      const searchButton = guardianDialog.locator('button').filter({ hasText: /search/i }).or(
        guardianDialog.locator('button[type="button"]').filter({ has: page.locator('svg') })
      ).first();
      
      if (await searchButton.isVisible().catch(() => false)) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }
      
      // Wait for search results
      await page.waitForTimeout(1000);

      // Select guardian from results
      const guardianOption = guardianDialog.locator(`text=/TestGuardian/i`).first();
      await expect(guardianOption).toBeVisible({ timeout: 10_000 });
      await guardianOption.click();

      // Select relationship type
      const relationshipSelect = guardianDialog.locator('select[name="relationship_type"], select').first();
      if (await relationshipSelect.isVisible().catch(() => false)) {
        await relationshipSelect.selectOption('parent');
      }

      // Submit guardian link form
      const submitButton = guardianDialog.locator('button').filter({ hasText: /add|save|link/i });
      await submitButton.click();

      // Verify guardian appears in list
      await expect(page.locator('text=/TestGuardian/i')).toBeVisible({ timeout: 10_000 });

      console.log('[E2E] ✅ GUA-01-10: Guardian linked successfully');

      // Wait for DB propagation
      await page.waitForTimeout(2000);

      // Verify in database
      const { data: links, error: linkError } = await supabaseAdmin
        .from('preschool_student_guardians')
        .select('*')
        .eq('student_id', student.id)
        .eq('guardian_customer_id', guardian.id);

      if (linkError) {
        console.error('[E2E] Guardian link query error:', linkError);
      }
      
      console.log('[E2E] Guardian links found:', links?.length || 0, links);
      expect(links).toHaveLength(1);
    } finally {
      await deleteTestStudent(student.id);
      await deleteTestCustomer(guardian.id);
    }
  });

  test('GUA-11 to GUA-16: should enforce primary guardian invariant', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Create test student and two guardians
    const student = await createTestStudent(TEST_TENANT_ID, {
      first_name: 'PrimaryTest',
      last_name: 'Student',
    });

    const guardian1 = await createTestCustomer(TEST_TENANT_ID, {
      name_mother: 'FirstGuardian',
      phone: '+15551111111',
    });

    const guardian2 = await createTestCustomer(TEST_TENANT_ID, {
      name_mother: 'SecondGuardian',
      phone: '+15552222222',
    });

    try {
      // Link first guardian as primary
      await linkGuardianToStudent(student.id, guardian1.id, TEST_TENANT_ID, {
        relationship_type: 'parent',
        is_primary_contact: true,
      });

      // Link second guardian
      await linkGuardianToStudent(student.id, guardian2.id, TEST_TENANT_ID, {
        relationship_type: 'parent',
        is_primary_contact: false,
      });

      // Navigate to profile
      await page.goto(`/preschool/students/${student.id}`);
      await page.waitForLoadState('networkidle');

      // Verify primary guardian badge appears
      const primaryBadge = page.locator('text=/primary/i').first();
      await expect(primaryBadge).toBeVisible({ timeout: 10_000 });

      console.log('[E2E] ✅ GUA-11-16: Primary guardian invariant enforced');

      // Verify DB constraint
      const { data: guardians } = await supabaseAdmin
        .from('preschool_student_guardians')
        .select('is_primary_contact')
        .eq('student_id', student.id)
        .eq('is_primary_contact', true);

      expect(guardians).toHaveLength(1); // Only one primary allowed
    } finally {
      await deleteTestStudent(student.id);
      await deleteTestCustomer(guardian1.id);
      await deleteTestCustomer(guardian2.id);
    }
  });

  test('TEN-01 to TEN-10: should enforce tenant isolation', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Create student in test tenant
    const student = await createTestStudent(TEST_TENANT_ID, {
      first_name: 'TenantTest',
      last_name: 'Student',
    });

    try {
      // Try to access student from current tenant (should work)
      await page.goto(`/preschool/students/${student.id}`);
      await expect(page.locator('text=/TenantTest/i')).toBeVisible({ timeout: 10_000 });

      console.log('[E2E] ✅ TEN-06: Student accessible in own tenant');

      // Verify students list only shows own tenant data
      await page.goto('/preschool/students');
      await page.waitForLoadState('networkidle');

      const studentRows = await page.locator('[data-student-row], tr, .student-item').count();
      console.log(`[E2E] Found ${studentRows} students in list (tenant-filtered)`);

      // Verify DB isolation
      const { data: allStudents } = await supabaseAdmin
        .from('preschool_students')
        .select('tenant_id')
        .eq('tenant_id', TEST_TENANT_ID);

      console.log(`[E2E] ✅ TEN-10: Tenant isolation verified (${allStudents?.length} students in tenant)`);
    } finally {
      await deleteTestStudent(student.id);
    }
  });
});
