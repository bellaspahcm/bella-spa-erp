/**
 * Bella Preschool P3.3 — Enrollment Management UI
 * Isolated E2E Validation Suite
 *
 * Following P3.1/P3.2 discipline: stable identity, isolated data, real auth
 */

import { test, expect } from '../helpers/real-auth-fixture';
import {
  createTestStudent,
  createTestClassroom,
  enrollTestStudent,
} from '../helpers/preschool-test-data';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test tenant: Tenant A Leak Test (non-HQ, active)
const TEST_TENANT_ID = '3f042f90-e9bb-448a-8001-2f418a705dad';

test.describe('P3.3 Enrollment Management UI', () => {
  test.setTimeout(180_000);

  /**
   * ENR-01: List enrollments
   */
  test('ENR-01: should display enrollment list', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create test data
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR01',
      last_name: 'Student',
      date_of_birth: '2020-06-01',
    });

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-01-Room-${Date.now()}`,
      age_group: '3-4 years',
    });

    const enrollment = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom.id,
    });

    try {
      // Navigate to enrollments page
      await page.goto('/preschool/enrollments');
      await page.waitForLoadState('networkidle');

      // Verify enrollment appears in list
      await expect(page.getByText('ENR01 Student')).toBeVisible();
      await expect(page.getByText(classroom.classroom_name)).toBeVisible();
      await expect(page.getByText('active')).toBeVisible();

      // Verify "Enroll Student" button present
      await expect(page.getByRole('link', { name: /enroll student/i })).toBeVisible();

      console.log('[E2E] ✅ ENR-01: Enrollment list displays correctly');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * ENR-02: Create enrollment
   */
  test('ENR-02: should enroll student in classroom', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create student and classroom
    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR02',
      last_name: 'Student',
      date_of_birth: '2020-07-01',
    });

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-02-Room-${Date.now()}`,
      age_group: '4-5 years',
      capacity: 20,
    });

    let createdEnrollmentId: string | null = null;

    try {
      // Navigate to new enrollment page
      await page.goto('/preschool/enrollments/new');
      await page.waitForLoadState('networkidle');

      // Select student
      await page.selectOption('select[name="student_id"]', student.id);

      // Select classroom
      await page.selectOption('select[name="classroom_id"]', classroom.id);

      // Set enrollment date
      const enrollmentDate = new Date().toISOString().split('T')[0];
      await page.fill('input[name="enrollment_date"]', enrollmentDate);

      // Submit
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Verify redirect to enrollments list
      await expect(page).toHaveURL('/preschool/enrollments');

      // Verify enrollment in DB
      const { data: enrollments } = await supabaseAdmin
        .from('preschool_enrollments')
        .select('*')
        .eq('student_id', student.id)
        .eq('classroom_id', classroom.id)
        .eq('tenant_id', TEST_TENANT_ID);

      expect(enrollments).toBeTruthy();
      expect(enrollments!.length).toBe(1);
      expect(enrollments![0].status).toBe('active');

      createdEnrollmentId = enrollments![0].id;

      console.log('[E2E] ✅ ENR-02: Enrollment created successfully');
    } finally {
      if (createdEnrollmentId) {
        await supabaseAdmin
          .from('preschool_enrollments')
          .delete()
          .eq('id', createdEnrollmentId);
      }
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * ENR-03: View enrollment detail
   */
  test('ENR-03: should display enrollment detail page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR03',
      last_name: 'Student',
      date_of_birth: '2020-08-01',
    });

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-03-Room-${Date.now()}`,
      age_group: '3-4 years',
    });

    const enrollment = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom.id,
    });

    try {
      await page.goto(`/preschool/enrollments/${enrollment.id}`);
      await page.waitForLoadState('networkidle');

      // Verify enrollment details
      await expect(page.getByText('ENR03 Student')).toBeVisible();
      await expect(page.getByText(classroom.classroom_name)).toBeVisible();
      
      // Verify enrollment status badge (first in header area)
      const statusBadges = page.locator('text=active');
      await expect(statusBadges.first()).toBeVisible();

      // Verify student and classroom links present
      await expect(page.getByRole('link', { name: /ENR03 Student/i })).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(classroom.classroom_name, 'i') })).toBeVisible();

      // Verify action buttons for active enrollment
      await expect(page.getByRole('button', { name: /mark as completed/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /withdraw/i })).toBeVisible();

      console.log('[E2E] ✅ ENR-03: Enrollment detail displays correctly');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * ENR-04: Update enrollment status to completed
   */
  test('ENR-04: should mark enrollment as completed', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR04',
      last_name: 'Student',
      date_of_birth: '2020-09-01',
    });

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-04-Room-${Date.now()}`,
    });

    const enrollment = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom.id,
    });

    try {
      await page.goto(`/preschool/enrollments/${enrollment.id}`);
      await page.waitForLoadState('networkidle');

      // Click "Mark as Completed"
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("Mark as Completed")');
      await page.waitForLoadState('networkidle');

      // Verify status updated in UI
      await expect(page.getByText('completed')).toBeVisible();

      // Verify action buttons no longer visible
      await expect(page.getByRole('button', { name: /mark as completed/i })).not.toBeVisible();

      // Verify in DB
      const { data } = await supabaseAdmin
        .from('preschool_enrollments')
        .select('*')
        .eq('id', enrollment.id)
        .single();

      expect(data.status).toBe('completed');
      expect(data.end_date).toBeTruthy();

      console.log('[E2E] ✅ ENR-04: Enrollment marked as completed successfully');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * ENR-05: Update enrollment status to withdrawn
   */
  test('ENR-05: should withdraw enrollment', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR05',
      last_name: 'Student',
      date_of_birth: '2020-10-01',
    });

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-05-Room-${Date.now()}`,
    });

    const enrollment = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom.id,
    });

    try {
      await page.goto(`/preschool/enrollments/${enrollment.id}`);
      await page.waitForLoadState('networkidle');

      // Click "Withdraw Enrollment"
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("Withdraw Enrollment")');
      await page.waitForLoadState('networkidle');

      // Verify status updated in UI (first withdrawn badge in header area)
      const withdrawnBadges = page.locator('text=withdrawn');
      await expect(withdrawnBadges.first()).toBeVisible();

      // Verify in DB
      const { data } = await supabaseAdmin
        .from('preschool_enrollments')
        .select('*')
        .eq('id', enrollment.id)
        .single();

      expect(data.status).toBe('withdrawn');
      expect(data.end_date).toBeTruthy();

      console.log('[E2E] ✅ ENR-05: Enrollment withdrawn successfully');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * ENR-06: Prevent duplicate active enrollment
   */
  test('ENR-06: should prevent enrolling student with existing active enrollment', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'ENR06',
      last_name: 'Student',
      date_of_birth: '2020-11-01',
    });

    const classroom1 = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-06-Room1-${Date.now()}`,
    });

    const classroom2 = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `ENR-06-Room2-${Date.now()}`,
    });

    // Create first enrollment
    const enrollment1 = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom1.id,
    });

    try {
      // Attempt to create second enrollment
      await page.goto('/preschool/enrollments/new');
      await page.waitForLoadState('networkidle');

      // Student should not appear in dropdown (has active enrollment)
      const studentOption = await page
        .locator(`select[name="student_id"] option[value="${student.id}"]`)
        .count();
      expect(studentOption).toBe(0);

      console.log('[E2E] ✅ ENR-06: Duplicate enrollment prevented correctly');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment1.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom1.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom2.id);
    }
  });

  /**
   * TEN-03: Tenant isolation for enrollments
   */
  test('TEN-03: should enforce tenant isolation on enrollments', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create enrollment in DIFFERENT tenant
    const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000001'; // Bella HQ

    const otherStudent = await createTestStudent(supabaseAdmin, OTHER_TENANT_ID, {
      first_name: 'TEN03',
      last_name: 'Other',
      date_of_birth: '2020-12-01',
    });

    const otherClassroom = await createTestClassroom(supabaseAdmin, OTHER_TENANT_ID, {
      classroom_name: `TEN-03-Other-${Date.now()}`,
    });

    const otherEnrollment = await enrollTestStudent(supabaseAdmin, OTHER_TENANT_ID, {
      student_id: otherStudent.id,
      classroom_id: otherClassroom.id,
    });

    try {
      // Attempt to access other tenant's enrollment
      await page.goto(`/preschool/enrollments/${otherEnrollment.id}`);
      await page.waitForLoadState('networkidle');

      // Should show error, not enrollment details
      await expect(page.getByText(/enrollment not found|failed to load/i)).toBeVisible();
      await expect(page.getByText('TEN03 Other')).not.toBeVisible();

      console.log('[E2E] ✅ TEN-03: Tenant isolation enforced on enrollments');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', otherEnrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', otherStudent.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', otherClassroom.id);
    }
  });
});
