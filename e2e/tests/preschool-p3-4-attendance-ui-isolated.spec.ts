/**
 * P3.4 Attendance Management UI — Isolated E2E Test Suite
 *
 * Pattern: Stable identity + isolated data + real auth + DB verification
 * Following P3.1/P3.2/P3.3 discipline
 */

import { test, expect } from '../helpers/real-auth-fixture';
import { createClient } from '@supabase/supabase-js';
import { createTestStudent } from '../helpers/preschool-test-data';

// Stable test identity (reused across all P3.x tests)
const TEST_TENANT_ID = '3f042f90-e9bb-448a-8001-2f418a705dad'; // Tenant A Leak Test

// Admin client for DB verification
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

test.describe('P3.4 Attendance Management UI', () => {
  test('ATT-01: should display daily attendance view', async ({ authenticatedPage: page }) => {
    // Setup: Create test student
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT01-001',
      first_name: 'ATT01',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Verify daily attendance view displays
    await expect(page.getByText('Daily Attendance')).toBeVisible();
    await expect(page.getByText('ATT01 Student')).toBeVisible();
    await expect(page.getByText('ATT01-001')).toBeVisible();

    // Verify initial state (not recorded)
    await expect(page.getByText('Not recorded').first()).toBeVisible();

    // Cleanup
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ ATT-01: Daily attendance view displays correctly');
  });

  test('ATT-02: should check in student', async ({ authenticatedPage: page }) => {
    // Setup: Create test student
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT02-001',
      first_name: 'ATT02',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Find student row and check in
    const studentRow = page.getByTestId('student-row-ATT02-001');
    await studentRow.getByRole('button', { name: /check in/i }).click();

    // Verify success toast
    await expect(page.getByText('Student checked in')).toBeVisible();

    // Verify status updated in UI
    await expect(page.getByText('Checked In').first()).toBeVisible();

    // Verify in DB
    const today = new Date().toISOString().split('T')[0];
    const { data: attendance } = await supabaseAdmin
      .from('preschool_attendance')
      .select('*')
      .eq('student_id', student!.id)
      .eq('attendance_date', today)
      .single();

    expect(attendance).toBeTruthy();
    expect(attendance!.status).toBe('checked_in');
    expect(attendance!.check_in_time).toBeTruthy();
    expect(attendance!.tenant_id).toBe(TEST_TENANT_ID);

    // Cleanup
    await supabaseAdmin.from('preschool_attendance').delete().eq('id', attendance!.id);
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ ATT-02: Student checked in successfully');
  });

  test('ATT-03: should check out student', async ({ authenticatedPage: page }) => {
    // Setup: Create student and check-in record
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT03-001',
      first_name: 'ATT03',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    const today = new Date().toISOString().split('T')[0];
    const attendanceData = {
      tenant_id: TEST_TENANT_ID,
      student_id: student!.id,
      attendance_date: today,
      check_in_time: new Date().toISOString(),
      status: 'checked_in',
    };

    const { data: attendance } = await supabaseAdmin
      .from('preschool_attendance')
      .insert(attendanceData)
      .select()
      .single();

    expect(attendance).toBeTruthy();

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Find student row and check out
    const studentRow = page.getByTestId('student-row-ATT03-001');
    await studentRow.getByRole('button', { name: /check out/i }).click();

    // Verify success toast
    await expect(page.getByText('Student checked out')).toBeVisible();

    // Verify status updated in UI
    await expect(page.getByText('Checked Out').first()).toBeVisible();

    // Verify in DB
    const { data: updated } = await supabaseAdmin
      .from('preschool_attendance')
      .select('*')
      .eq('id', attendance!.id)
      .single();

    expect(updated).toBeTruthy();
    expect(updated!.status).toBe('checked_out');
    expect(updated!.check_out_time).toBeTruthy();

    // Cleanup
    await supabaseAdmin.from('preschool_attendance').delete().eq('id', attendance!.id);
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ ATT-03: Student checked out successfully');
  });

  test('ATT-04: should prevent duplicate check-in', async ({ authenticatedPage: page }) => {
    // Setup: Create student already checked in
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT04-001',
      first_name: 'ATT04',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    const today = new Date().toISOString().split('T')[0];
    const attendanceData = {
      tenant_id: TEST_TENANT_ID,
      student_id: student!.id,
      attendance_date: today,
      check_in_time: new Date().toISOString(),
      status: 'checked_in',
    };

    const { data: attendance } = await supabaseAdmin
      .from('preschool_attendance')
      .insert(attendanceData)
      .select()
      .single();

    expect(attendance).toBeTruthy();

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Verify student is already checked in (no check-in button, only check-out button)
    const studentRow = page.getByTestId('student-row-ATT04-001');
    await expect(studentRow.getByRole('button', { name: /check in/i })).not.toBeVisible();
    await expect(studentRow.getByRole('button', { name: /check out/i })).toBeVisible();

    // Verify status
    await expect(studentRow.getByText('Checked In')).toBeVisible();

    // Cleanup
    await supabaseAdmin.from('preschool_attendance').delete().eq('id', attendance!.id);
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ ATT-04: Duplicate check-in prevented correctly');
  });

  test('ATT-05: should prevent check-out without check-in', async ({ authenticatedPage: page }) => {
    // Setup: Create student NOT checked in
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT05-001',
      first_name: 'ATT05',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Verify student has check-in button, NOT check-out button
    const studentRow = page.getByTestId('student-row-ATT05-001');
    await expect(studentRow.getByRole('button', { name: /check in/i })).toBeVisible();
    await expect(studentRow.getByRole('button', { name: /check out/i })).not.toBeVisible();

    // Cleanup
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ ATT-05: Check-out without check-in prevented correctly');
  });

  test('ATT-06: should display current attendance state', async ({ authenticatedPage: page }) => {
    // Setup: Create three students with different states
    const student1 = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT06-001',
      first_name: 'ATT06-CheckedIn',
      last_name: 'Student',
      date_of_birth: '2020-01-01',
    });

    const student2 = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT06-002',
      first_name: 'ATT06-CheckedOut',
      last_name: 'Student',
      date_of_birth: '2020-01-02',
    });

    const student3 = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_code: 'ATT06-003',
      first_name: 'ATT06-NotRecorded',
      last_name: 'Student',
      date_of_birth: '2020-01-03',
    });

    const insertedStudents = [student1, student2, student3];

    const today = new Date().toISOString().split('T')[0];

    // Student 1: checked in
    const { data: att1 } = await supabaseAdmin
      .from('preschool_attendance')
      .insert({
        tenant_id: TEST_TENANT_ID,
        student_id: insertedStudents[0]!.id,
        attendance_date: today,
        check_in_time: new Date().toISOString(),
        status: 'checked_in',
      })
      .select()
      .single();

    // Student 2: checked out
    const { data: att2 } = await supabaseAdmin
      .from('preschool_attendance')
      .insert({
        tenant_id: TEST_TENANT_ID,
        student_id: insertedStudents[1]!.id,
        attendance_date: today,
        check_in_time: new Date(Date.now() - 3600000).toISOString(),
        check_out_time: new Date().toISOString(),
        status: 'checked_out',
      })
      .select()
      .single();

    // Student 3: no record

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Verify each state
    const row1 = page.getByTestId('student-row-ATT06-001');
    await expect(row1.getByText('Checked In')).toBeVisible();

    const row2 = page.getByTestId('student-row-ATT06-002');
    await expect(row2.getByText('Checked Out')).toBeVisible();

    const row3 = page.getByTestId('student-row-ATT06-003');
    await expect(row3.getByText('Not recorded')).toBeVisible();

    // Cleanup
    if (att1) await supabaseAdmin.from('preschool_attendance').delete().eq('id', att1.id);
    if (att2) await supabaseAdmin.from('preschool_attendance').delete().eq('id', att2.id);
    for (const s of insertedStudents) {
      await supabaseAdmin.from('preschool_students').delete().eq('id', s!.id);
    }

    console.log('[E2E] ✅ ATT-06: Current attendance state displays correctly');
  });

  test('TEN-04: should enforce tenant isolation on attendance', async ({ authenticatedPage: page }) => {
    // Setup: Create student in DIFFERENT tenant (Bella HQ)
    const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000001'; // Bella HQ

    // Create student in DIFFERENT tenant
    const student = await createTestStudent(supabaseAdmin, OTHER_TENANT_ID, {
      student_code: 'TEN04-001',
      first_name: 'TEN04',
      last_name: 'OtherTenant',
      date_of_birth: '2020-01-01',
    });

    const today = new Date().toISOString().split('T')[0];
    const attendanceData = {
      tenant_id: OTHER_TENANT_ID,
      student_id: student!.id,
      attendance_date: today,
      check_in_time: new Date().toISOString(),
      status: 'checked_in',
    };

    const { data: attendance } = await supabaseAdmin
      .from('preschool_attendance')
      .insert(attendanceData)
      .select()
      .single();

    expect(attendance).toBeTruthy();

    // Navigate to attendance page
    await page.goto('/preschool/attendance');
    await page.waitForLoadState('networkidle');

    // Verify other tenant's student NOT visible
    await expect(page.getByText('TEN04 OtherTenant')).not.toBeVisible();

    // Cleanup
    await supabaseAdmin.from('preschool_attendance').delete().eq('id', attendance!.id);
    await supabaseAdmin.from('preschool_students').delete().eq('id', student!.id);

    console.log('[E2E] ✅ TEN-04: Tenant isolation enforced on attendance');
  });
});
