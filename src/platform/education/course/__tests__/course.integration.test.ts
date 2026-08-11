/**
 * Course Integration Tests
 * 
 * Tests Course with actual database operations
 * 
 * Pattern: Inherited from Student integration tests
 */

import { CourseService } from '../course.service';
import { createClient } from '@/lib/supabase-server';
import type { CreateCourseRequest, UpdateCourseRequest } from '../../shared-kernel/course-types';

const TEST_TENANT_UUID = '00000000-0000-0000-0000-000000000088';
const TEST_USER_UUID = '00000000-0000-0000-0000-000000000001';

describe('Course Integration Tests', () => {
  let courseId: string;
  const tenantId = TEST_TENANT_UUID;

  afterAll(async () => {
    // Cleanup
    const supabase = await createClient();
    await supabase.from('courses').delete().eq('tenant_id', tenantId);
  });

  describe('CRUD Operations', () => {
    it('should create course', async () => {
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'CS101',
        courseName: 'Introduction to Computer Science',
        description: 'Fundamentals of CS',
        credits: 3,
        durationWeeks: 16,
        maxStudents: 30,
        minStudents: 10,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);

      expect(result.success).toBe(true);
      expect(result.course).toBeDefined();
      expect(result.course?.courseCode).toBe('CS101');
      expect(result.course?.courseName).toBe('Introduction to Computer Science');
      expect(result.course?.status).toBe('draft');
      expect(result.course?.currentEnrollment).toBe(0);

      courseId = result.course!.courseId;
    });

    it('should reject duplicate course code in same tenant', async () => {
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'CS101', // Duplicate
        courseName: 'Duplicate Course',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should get course by ID', async () => {
      const result = await CourseService.getCourseById(courseId, tenantId);

      expect(result.success).toBe(true);
      expect(result.course).toBeDefined();
      expect(result.course?.courseId).toBe(courseId);
    });

    it('should get course by course code', async () => {
      const result = await CourseService.getCourseByCourseCode('CS101', tenantId);

      expect(result.success).toBe(true);
      expect(result.course).toBeDefined();
      expect(result.course?.courseCode).toBe('CS101');
    });

    it('should update course', async () => {
      const request: UpdateCourseRequest = {
        courseId,
        tenantId,
        courseName: 'Intro to CS - Updated',
        description: 'Updated description',
        updatedBy: TEST_USER_UUID,
      };

      const result = await CourseService.updateCourse(request);

      expect(result.success).toBe(true);
      expect(result.course?.courseName).toBe('Intro to CS - Updated');
      expect(result.course?.description).toBe('Updated description');
    });

    it('should query courses by tenant', async () => {
      const result = await CourseService.queryCourses({ tenantId });

      expect(result.success).toBe(true);
      expect(result.courses.length).toBeGreaterThan(0);
      expect(result.courses.every(c => c.tenantId === tenantId)).toBe(true);
    });

    it('should query courses by status', async () => {
      const result = await CourseService.queryCourses({
        tenantId,
        status: 'draft',
      });

      expect(result.success).toBe(true);
      expect(result.courses.every(c => c.status === 'draft')).toBe(true);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not find course from different tenant', async () => {
      const otherTenantId = '99999999-9999-9999-9999-999999999999';

      const result = await CourseService.getCourseById(courseId, otherTenantId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should only return courses from same tenant in query', async () => {
      const result = await CourseService.queryCourses({ tenantId });

      expect(result.success).toBe(true);
      expect(result.courses.every(c => c.tenantId === tenantId)).toBe(true);
    });
  });

  describe('Status Transitions', () => {
    it('should activate course', async () => {
      const result = await CourseService.activateCourse(courseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(true);
      expect(result.course?.status).toBe('active');
    });

    it('should start course', async () => {
      // First, simulate enrollments to meet minimum
      const supabase = await createClient();
      await supabase
        .from('courses')
        .update({ current_enrollment: 10 })
        .eq('id', courseId);

      const result = await CourseService.startCourse(courseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(true);
      expect(result.course?.status).toBe('in_progress');
    });

    it('should complete course', async () => {
      const result = await CourseService.completeCourse(courseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(true);
      expect(result.course?.status).toBe('completed');
    });

    it('should archive completed course', async () => {
      const result = await CourseService.archiveCourse(courseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(true);
      expect(result.course?.status).toBe('archived');
    });
  });

  describe('Business Rules', () => {
    let testCourseId: string;

    beforeAll(async () => {
      // Create test course for business rules
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'CS102',
        courseName: 'Data Structures',
        credits: 4,
        maxStudents: 20,
        minStudents: 5,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);
      testCourseId = result.course!.courseId;
    });

    it('should reject starting course without minimum enrollment', async () => {
      // Activate first
      await CourseService.activateCourse(testCourseId, tenantId, TEST_USER_UUID);

      // Try to start without meeting minimum
      const result = await CourseService.startCourse(testCourseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('minimum');
    });

    it('should reject cancelling completed course', async () => {
      // Create and complete a course
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'CS103',
        courseName: 'Algorithms',
        credits: 4,
        createdBy: TEST_USER_UUID,
      };

      const createResult = await CourseService.createCourse(request);
      const newCourseId = createResult.course!.courseId;

      // Activate, start, complete
      await CourseService.activateCourse(newCourseId, tenantId, TEST_USER_UUID);

      const supabase = await createClient();
      await supabase
        .from('courses')
        .update({ current_enrollment: 10 })
        .eq('id', newCourseId);

      await CourseService.startCourse(newCourseId, tenantId, TEST_USER_UUID);
      await CourseService.completeCourse(newCourseId, tenantId, TEST_USER_UUID);

      // Try to cancel
      const result = await CourseService.cancelCourse(newCourseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel completed course');
    });

    it('should reject archiving active course', async () => {
      const result = await CourseService.archiveCourse(testCourseId, tenantId, TEST_USER_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Can only archive completed or cancelled');
    });
  });

  describe('Validation', () => {
    it('should reject course with zero credits', async () => {
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'INVALID1',
        courseName: 'Invalid Course',
        credits: 0,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Credits must be greater than 0');
    });

    it('should reject course with min > max students', async () => {
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'INVALID2',
        courseName: 'Invalid Course',
        credits: 3,
        minStudents: 30,
        maxStudents: 20,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Min students cannot exceed max students');
    });

    it('should normalize course code to uppercase', async () => {
      const request: CreateCourseRequest = {
        tenantId,
        courseCode: 'cs104',
        courseName: 'Lowercase Test',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      const result = await CourseService.createCourse(request);

      expect(result.success).toBe(true);
      expect(result.course?.courseCode).toBe('CS104');
    });
  });
});
