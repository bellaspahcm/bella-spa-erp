/**
 * Bella Preschool P3.2 — Classroom Management UI
 * Isolated E2E Validation Suite
 *
 * Following P3.1 discipline: each test independent, tenant-isolated
 */

import { test, expect } from '../helpers/real-auth-fixture';
import {
  createTestStudent,
  createTestClassroom,
  enrollTestStudent,
  deleteTestStudent,
} from '../helpers/preschool-test-data';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test tenant: Tenant A Leak Test (non-HQ, active)
const TEST_TENANT_ID = '3f042f90-e9bb-448a-8001-2f418a705dad';

test.describe('P3.2 Classroom Management UI', () => {
  test.setTimeout(180_000);

  /**
   * CLS-01: List classrooms
   */
  test('CLS-01: should display classroom list', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create test classroom
    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `CLS-01-Room-${Date.now()}`,
      age_group: '3-4 years',
      capacity: 15,
    });

    try {
      // Navigate to classrooms page
      await page.goto('/preschool/classrooms');
      await page.waitForLoadState('networkidle');

      // Verify classroom appears in list
      await expect(page.getByText(classroom.classroom_name)).toBeVisible();
      await expect(page.getByText('3-4 years')).toBeVisible();

      // Verify "Add Classroom" button present
      await expect(page.getByRole('link', { name: /add classroom/i })).toBeVisible();

      console.log('[E2E] ✅ CLS-01: Classroom list displays correctly');
    } finally {
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * CLS-02: Create classroom
   */
  test('CLS-02: should create new classroom', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const classroomName = `CLS-02-Room-${Date.now()}`;
    let createdClassroomId: string | null = null;

    try {
      // Navigate to create page
      await page.goto('/preschool/classrooms/new');
      await page.waitForLoadState('networkidle');

      // Fill form
      await page.fill('input[name="classroom_name"]', classroomName);
      await page.fill('input[name="classroom_code"]', 'CLS-02');
      await page.fill('input[name="age_group"]', '4-5 years');
      await page.fill('input[name="capacity"]', '20');
      await page.fill('input[name="room_location"]', 'Building A, 2nd Floor');

      // Submit
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Verify redirect to detail page
      await expect(page).toHaveURL(/\/preschool\/classrooms\/[a-f0-9-]+$/);
      await expect(page.getByText(classroomName)).toBeVisible();
      await expect(page.getByText('4-5 years')).toBeVisible();
      await expect(page.getByText('Building A, 2nd Floor')).toBeVisible();

      // Extract ID from URL for cleanup
      const url = page.url();
      const match = url.match(/\/classrooms\/([a-f0-9-]+)$/);
      if (match) createdClassroomId = match[1];

      // Verify in DB
      if (createdClassroomId) {
        const { data } = await supabaseAdmin
          .from('preschool_classrooms')
          .select('*')
          .eq('id', createdClassroomId)
          .single();

        expect(data).toBeTruthy();
        expect(data.classroom_name).toBe(classroomName);
        expect(data.age_group).toBe('4-5 years');
        expect(data.capacity).toBe(20);
        expect(data.tenant_id).toBe(TEST_TENANT_ID);
      }

      console.log('[E2E] ✅ CLS-02: Classroom created successfully');
    } finally {
      if (createdClassroomId) {
        await supabaseAdmin.from('preschool_classrooms').delete().eq('id', createdClassroomId);
      }
    }
  });

  /**
   * CLS-03: View classroom detail
   */
  test('CLS-03: should display classroom detail page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `CLS-03-Room-${Date.now()}`,
      age_group: '3-4 years',
      capacity: 15,
      room_location: 'Building B',
    });

    try {
      await page.goto(`/preschool/classrooms/${classroom.id}`);
      await page.waitForLoadState('networkidle');

      // Verify classroom details
      await expect(page.getByText(classroom.classroom_name)).toBeVisible();
      await expect(page.getByText('3-4 years')).toBeVisible();
      await expect(page.getByText(/0 \/ 15 students/)).toBeVisible();
      await expect(page.getByText('Building B')).toBeVisible();

      // Verify action buttons
      await expect(page.getByRole('link', { name: /edit/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /back/i })).toBeVisible();

      console.log('[E2E] ✅ CLS-03: Classroom detail displays correctly');
    } finally {
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * CLS-04: Edit classroom
   */
  test('CLS-04: should update classroom information', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `CLS-04-Room-${Date.now()}`,
      capacity: 15,
    });

    try {
      // Navigate to edit page
      await page.goto(`/preschool/classrooms/${classroom.id}/edit`);
      await page.waitForLoadState('networkidle');

      // Update fields
      const updatedName = `${classroom.classroom_name}-Updated`;
      await page.fill('input[name="classroom_name"]', updatedName);
      await page.fill('input[name="age_group"]', '5-6 years');
      await page.fill('input[name="capacity"]', '25');

      // Submit
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Verify redirect to detail page
      await expect(page).toHaveURL(`/preschool/classrooms/${classroom.id}`);
      await expect(page.getByText(updatedName)).toBeVisible();
      await expect(page.getByText('5-6 years')).toBeVisible();
      await expect(page.getByText(/0 \/ 25 students/)).toBeVisible();

      // Verify in DB
      const { data } = await supabaseAdmin
        .from('preschool_classrooms')
        .select('*')
        .eq('id', classroom.id)
        .single();

      expect(data.classroom_name).toBe(updatedName);
      expect(data.age_group).toBe('5-6 years');
      expect(data.capacity).toBe(25);

      console.log('[E2E] ✅ CLS-04: Classroom updated successfully');
    } finally {
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * CLS-05: Display enrolled students
   */
  test('CLS-05: should display enrolled students in classroom detail', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create classroom and student
    const classroom = await createTestClassroom(supabaseAdmin, TEST_TENANT_ID, {
      classroom_name: `CLS-05-Room-${Date.now()}`,
      capacity: 15,
    });

    const student = await createTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      first_name: 'CLS05',
      last_name: 'Student',
      date_of_birth: '2020-05-15',
    });

    // Enroll student
    const enrollment = await enrollTestStudent(supabaseAdmin, TEST_TENANT_ID, {
      student_id: student.id,
      classroom_id: classroom.id,
    });

    try {
      await page.goto(`/preschool/classrooms/${classroom.id}`);
      await page.waitForLoadState('networkidle');

      // Verify enrolled students section
      await expect(page.getByText('Enrolled Students')).toBeVisible();
      await expect(page.getByText('CLS05 Student')).toBeVisible();
      await expect(page.getByText(student.student_code)).toBeVisible();

      // Verify enrollment count
      await expect(page.getByText(/1 \/ 15 students/)).toBeVisible();

      console.log('[E2E] ✅ CLS-05: Enrolled students displayed correctly');
    } finally {
      await supabaseAdmin.from('preschool_enrollments').delete().eq('id', enrollment.id);
      await supabaseAdmin.from('preschool_students').delete().eq('id', student.id);
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', classroom.id);
    }
  });

  /**
   * TEN-02: Tenant isolation for classrooms
   */
  test('TEN-02: should enforce tenant isolation on classrooms', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Create classroom in DIFFERENT tenant using service role
    const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000001'; // Bella HQ
    const otherClassroom = await createTestClassroom(supabaseAdmin, OTHER_TENANT_ID, {
      classroom_name: `TEN-02-Other-${Date.now()}`,
    });

    try {
      // Attempt to access other tenant's classroom
      await page.goto(`/preschool/classrooms/${otherClassroom.id}`);
      await page.waitForLoadState('networkidle');

      // Should show error, not classroom details
      await expect(page.getByText(/classroom not found|failed to load/i)).toBeVisible();
      await expect(page.getByText(otherClassroom.classroom_name)).not.toBeVisible();

      console.log('[E2E] ✅ TEN-02: Tenant isolation enforced on classrooms');
    } finally {
      await supabaseAdmin.from('preschool_classrooms').delete().eq('id', otherClassroom.id);
    }
  });
});
