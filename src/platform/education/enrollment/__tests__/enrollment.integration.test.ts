/**
 * Enrollment Integration Tests
 */

import { EnrollmentService } from '../enrollment.service';
import { StudentService } from '../../student/student.service';
import { PersonService } from '@/platform/host/person/person.service';
import { CreateEnrollmentRequest } from '../../shared-kernel/enrollment-types';
import { createClient } from '@/lib/supabase-server';
import { TEST_USER_UUID, NON_EXISTENT_UUID, TEST_TENANT_UUID, ensureTestTenantExists, cleanupTestTenant } from '@/platform/__tests__/test-helpers';

describe('Enrollment Integration Tests', () => {
  // Use same tenant as Student tests (known to exist)
  const tenantId = '00000000-0000-0000-0000-000000000088';
  let personId: string;
  let studentId: string;
  let courseId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    // Skip tenant seeding - use existing tenant from environment
    const supabase = await createClient();
    const personService = new PersonService(supabase);

    // Create Person
    const personResult = await personService.createPerson({
      tenantId,
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '2001-05-20',
      gender: 'female',
      createdBy: TEST_USER_UUID,
    });
    
    if (!personResult.success) {
      console.error('Person creation error:', personResult.error);
      throw new Error(`Person creation failed: ${personResult.error?.message || 'Unknown error'}`);
    }
    if (!personResult.data) {
      throw new Error('Person creation returned no data');
    }
    
    personId = personResult.data.personId;

    // Create Student
    const student = await StudentService.createStudent({
      tenantId,
      personId,
      studentCode: 'EDU-2024-100',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'program-cs',
      enrollmentDate: '2024-09-01',
      createdBy: TEST_USER_UUID,
    });
    studentId = student.studentId;

    // Create Course
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .insert({
        tenant_id: tenantId,
        course_code: 'CS101',
        course_name: 'Introduction to Computer Science',
        credits: 3,
        status: 'active',
        created_by: TEST_USER_UUID,
      })
      .select()
      .single();

    if (courseError) throw new Error(`Course creation failed: ${courseError.message}`);
    courseId = courseData.id;
  });

  afterAll(async () => {
    // Manual cleanup (tenant-specific)
    const supabase = await createClient();
    await supabase.from('enrollments').delete().eq('tenant_id', tenantId);
    await supabase.from('courses').delete().eq('tenant_id', tenantId);
    await supabase.from('students').delete().eq('tenant_id', tenantId);
    await supabase.from('persons').delete().eq('tenant_id', tenantId);
  });

  describe('FK Validation', () => {
    it('should create enrollment with valid Student and Course', async () => {
      const request: CreateEnrollmentRequest = {
        tenantId,
        studentId,
        courseId,
        enrollmentDate: '2024-09-01',
        createdBy: TEST_USER_UUID,
      };

      const enrollment = await EnrollmentService.createEnrollment(request);
      enrollmentId = enrollment.enrollmentId;

      expect(enrollment).toBeDefined();
      expect(enrollment.studentId).toBe(studentId);
      expect(enrollment.courseId).toBe(courseId);
      expect(enrollment.status).toBe('pending');
    });

    it('should reject enrollment if Student does not exist', async () => {
      const request: CreateEnrollmentRequest = {
        tenantId,
        studentId: NON_EXISTENT_UUID,
        courseId,
        enrollmentDate: '2024-09-01',
        createdBy: TEST_USER_UUID,
      };

      await expect(EnrollmentService.createEnrollment(request)).rejects.toThrow('Student with ID');
    });

    it('should reject enrollment if Course does not exist', async () => {
      const request: CreateEnrollmentRequest = {
        tenantId,
        studentId,
        courseId: NON_EXISTENT_UUID,
        enrollmentDate: '2024-09-01',
        createdBy: TEST_USER_UUID,
      };

      await expect(EnrollmentService.createEnrollment(request)).rejects.toThrow('Course with ID');
    });

    it('should reject duplicate enrollment (same Student + Course)', async () => {
      const request: CreateEnrollmentRequest = {
        tenantId,
        studentId,
        courseId,
        enrollmentDate: '2024-09-02',
        createdBy: TEST_USER_UUID,
      };

      await expect(EnrollmentService.createEnrollment(request)).rejects.toThrow('already enrolled');
    });
  });

  describe('Business Rules', () => {
    it('should reject enrollment of graduated student', async () => {
      // Graduate student
      await StudentService.graduateStudent(studentId, tenantId, '2024-06-30', TEST_USER_UUID);

      const supabase = await createClient();
      const { data: course2 } = await supabase
        .from('courses')
        .insert({
          tenant_id: tenantId,
          course_code: 'CS102',
          course_name: 'Data Structures',
          credits: 3,
          status: 'active',
          created_by: TEST_USER_UUID,
        })
        .select()
        .single();

      const request: CreateEnrollmentRequest = {
        tenantId,
        studentId,
        courseId: course2!.id,
        enrollmentDate: '2024-09-01',
        createdBy: TEST_USER_UUID,
      };

      await expect(EnrollmentService.createEnrollment(request)).rejects.toThrow('Cannot enroll graduated student');

      // Cleanup: Reinstate student for other tests
      await StudentService.reinstateStudent(studentId, tenantId, TEST_USER_UUID);
      await supabase.from('courses').delete().eq('id', course2!.id);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not find enrollment from different tenant', async () => {
      const enrollment = await EnrollmentService.getEnrollmentById(enrollmentId, 'different-tenant');
      expect(enrollment).toBeNull();
    });

    it('should find enrollment only in same tenant', async () => {
      const enrollment = await EnrollmentService.getEnrollmentById(enrollmentId, tenantId);
      expect(enrollment).toBeDefined();
      expect(enrollment?.enrollmentId).toBe(enrollmentId);
    });
  });

  describe('CRUD Operations', () => {
    it('should get enrollment by ID', async () => {
      const enrollment = await EnrollmentService.getEnrollmentById(enrollmentId, tenantId);
      expect(enrollment).toBeDefined();
      expect(enrollment?.studentId).toBe(studentId);
    });

    it('should get enrollments by student', async () => {
      const enrollments = await EnrollmentService.getEnrollmentsByStudent(studentId, tenantId);
      expect(enrollments.length).toBeGreaterThan(0);
      expect(enrollments[0].studentId).toBe(studentId);
    });

    it('should get enrollments by course', async () => {
      const enrollments = await EnrollmentService.getEnrollmentsByCourse(courseId, tenantId);
      expect(enrollments.length).toBeGreaterThan(0);
      expect(enrollments[0].courseId).toBe(courseId);
    });

    it('should update enrollment', async () => {
      const updated = await EnrollmentService.updateEnrollment({
        enrollmentId,
        tenantId,
        attendancePercentage: 95,
        updatedBy: TEST_USER_UUID,
      });

      expect(updated.attendancePercentage).toBe(95);
    });
  });

  describe('Status Transitions', () => {
    it('should activate pending enrollment', async () => {
      const activated = await EnrollmentService.activateEnrollment(enrollmentId, tenantId, TEST_USER_UUID);
      expect(activated.status).toBe('active');
    });

    it('should complete active enrollment', async () => {
      const completed = await EnrollmentService.completeEnrollment(
        enrollmentId,
        tenantId,
        '2024-12-15',
        TEST_USER_UUID
      );
      expect(completed.status).toBe('completed');
      expect(completed.completionDate).toBe('2024-12-15');
    });

    it('should assign grade to enrollment', async () => {
      const graded = await EnrollmentService.assignGrade(enrollmentId, tenantId, 'A', 90, 3, TEST_USER_UUID);
      expect(graded.grade).toBe('A');
      expect(graded.gradePoints).toBe(90);
      expect(graded.creditsEarned).toBe(3);
      expect(graded.getGrade().status).toBe('pass');
    });
  });
});
