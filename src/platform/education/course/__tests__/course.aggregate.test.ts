/**
 * Course Aggregate Unit Tests
 * 
 * Tests business rules in isolation (no database)
 */

import {
  createCourse,
  updateCourse,
  activateCourse,
  startCourse,
  completeCourse,
  cancelCourse,
  archiveCourse,
  updateEnrollmentCount,
  isFull,
  canEnroll,
} from '../course.aggregate';
import type { Course, CreateCourseRequest, UpdateCourseRequest } from '../../shared-kernel/course-types';

const TEST_TENANT_UUID = '00000000-0000-0000-0000-000000000088';
const TEST_USER_UUID = '00000000-0000-0000-0000-000000000001';

describe('Course Aggregate', () => {
  describe('createCourse', () => {
    it('should create valid course', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      const course = createCourse(request);

      expect(course.tenantId).toBe(TEST_TENANT_UUID);
      expect(course.courseCode).toBe('CS101');
      expect(course.courseName).toBe('Intro to CS');
      expect(course.credits).toBe(3);
      expect(course.status).toBe('draft');
      expect(course.currentEnrollment).toBe(0);
      expect(course.createdBy).toBe(TEST_USER_UUID);
    });

    it('should normalize course code to uppercase', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'cs101',
        courseName: 'Intro to CS',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      const course = createCourse(request);

      expect(course.courseCode).toBe('CS101');
    });

    it('should reject empty course code', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: '',
        courseName: 'Intro to CS',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      expect(() => createCourse(request)).toThrow('Course code is required');
    });

    it('should reject empty course name', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: '',
        credits: 3,
        createdBy: TEST_USER_UUID,
      };

      expect(() => createCourse(request)).toThrow('Course name is required');
    });

    it('should reject zero or negative credits', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 0,
        createdBy: TEST_USER_UUID,
      };

      expect(() => createCourse(request)).toThrow('Credits must be greater than 0');
    });

    it('should reject min students exceeding max students', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        minStudents: 20,
        maxStudents: 10,
        createdBy: TEST_USER_UUID,
      };

      expect(() => createCourse(request)).toThrow('Min students cannot exceed max students');
    });

    it('should reject end date before start date', () => {
      const request: CreateCourseRequest = {
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        startDate: '2024-12-01',
        endDate: '2024-11-01',
        createdBy: TEST_USER_UUID,
      };

      expect(() => createCourse(request)).toThrow('End date must be after start date');
    });
  });

  describe('updateCourse', () => {
    const existingCourse: Course = {
      courseId: 'course-1',
      tenantId: TEST_TENANT_UUID,
      courseCode: 'CS101',
      courseName: 'Intro to CS',
      credits: 3,
      status: 'draft',
      currentEnrollment: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: TEST_USER_UUID,
    };

    it('should update course name', () => {
      const request: UpdateCourseRequest = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseName: 'Introduction to Computer Science',
        updatedBy: TEST_USER_UUID,
      };

      const updated = updateCourse(existingCourse, request);

      expect(updated.courseName).toBe('Introduction to Computer Science');
      expect(updated.updatedBy).toBe(TEST_USER_UUID);
    });

    it('should reject update from different tenant', () => {
      const request: UpdateCourseRequest = {
        courseId: 'course-1',
        tenantId: '99999999-9999-9999-9999-999999999999',
        courseName: 'Hacked',
        updatedBy: TEST_USER_UUID,
      };

      expect(() => updateCourse(existingCourse, request)).toThrow('Cannot update course from different tenant');
    });

    it('should reject zero or negative credits', () => {
      const request: UpdateCourseRequest = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        credits: 0,
        updatedBy: TEST_USER_UUID,
      };

      expect(() => updateCourse(existingCourse, request)).toThrow('Credits must be greater than 0');
    });
  });

  describe('activateCourse', () => {
    it('should activate draft course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'draft',
        currentEnrollment: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const activated = activateCourse(course, TEST_USER_UUID);

      expect(activated.status).toBe('active');
      expect(activated.updatedBy).toBe(TEST_USER_UUID);
    });

    it('should reject activating cancelled course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'cancelled',
        currentEnrollment: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => activateCourse(course, TEST_USER_UUID)).toThrow('Cannot activate cancelled course');
    });

    it('should reject activating completed course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'completed',
        currentEnrollment: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => activateCourse(course, TEST_USER_UUID)).toThrow('Cannot activate completed course');
    });
  });

  describe('startCourse', () => {
    it('should start active course with sufficient enrollment', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        minStudents: 5,
        currentEnrollment: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const started = startCourse(course, TEST_USER_UUID);

      expect(started.status).toBe('in_progress');
    });

    it('should reject starting draft course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'draft',
        currentEnrollment: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => startCourse(course, TEST_USER_UUID)).toThrow('Can only start active or full courses');
    });

    it('should reject starting course with insufficient enrollment', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        minStudents: 10,
        currentEnrollment: 5,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => startCourse(course, TEST_USER_UUID)).toThrow('minimum 10 students required, only 5 enrolled');
    });
  });

  describe('completeCourse', () => {
    it('should complete in-progress course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'in_progress',
        currentEnrollment: 15,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const completed = completeCourse(course, TEST_USER_UUID);

      expect(completed.status).toBe('completed');
    });

    it('should reject completing non-in-progress course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 15,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => completeCourse(course, TEST_USER_UUID)).toThrow('Can only complete courses that are in progress');
    });
  });

  describe('cancelCourse', () => {
    it('should cancel active course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 5,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const cancelled = cancelCourse(course, TEST_USER_UUID);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancelling completed course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'completed',
        currentEnrollment: 15,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => cancelCourse(course, TEST_USER_UUID)).toThrow('Cannot cancel completed course');
    });
  });

  describe('archiveCourse', () => {
    it('should archive completed course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'completed',
        currentEnrollment: 15,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const archived = archiveCourse(course, TEST_USER_UUID);

      expect(archived.status).toBe('archived');
    });

    it('should archive cancelled course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'cancelled',
        currentEnrollment: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const archived = archiveCourse(course, TEST_USER_UUID);

      expect(archived.status).toBe('archived');
    });

    it('should reject archiving active course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => archiveCourse(course, TEST_USER_UUID)).toThrow('Can only archive completed or cancelled courses');
    });
  });

  describe('updateEnrollmentCount', () => {
    it('should update enrollment count', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        maxStudents: 20,
        currentEnrollment: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const updated = updateEnrollmentCount(course, 15);

      expect(updated.currentEnrollment).toBe(15);
      expect(updated.status).toBe('active');
    });

    it('should mark course as full when reaching max students', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        maxStudents: 20,
        currentEnrollment: 19,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const updated = updateEnrollmentCount(course, 20);

      expect(updated.currentEnrollment).toBe(20);
      expect(updated.status).toBe('full');
    });

    it('should mark course as active when dropping below max students', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'full',
        maxStudents: 20,
        currentEnrollment: 20,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const updated = updateEnrollmentCount(course, 19);

      expect(updated.currentEnrollment).toBe(19);
      expect(updated.status).toBe('active');
    });

    it('should reject negative enrollment count', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => updateEnrollmentCount(course, -1)).toThrow('Enrollment count cannot be negative');
    });
  });

  describe('isFull', () => {
    it('should return true if status is full', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'full',
        currentEnrollment: 20,
        maxStudents: 20,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(isFull(course)).toBe(true);
    });

    it('should return true if enrollment equals max students', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 20,
        maxStudents: 20,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(isFull(course)).toBe(true);
    });

    it('should return false if no max students set', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 100,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(isFull(course)).toBe(false);
    });
  });

  describe('canEnroll', () => {
    it('should allow enrollment in active course with capacity', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'active',
        currentEnrollment: 10,
        maxStudents: 20,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(canEnroll(course)).toBe(true);
    });

    it('should reject enrollment in full course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'full',
        currentEnrollment: 20,
        maxStudents: 20,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(canEnroll(course)).toBe(false);
    });

    it('should reject enrollment in draft course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'draft',
        currentEnrollment: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(canEnroll(course)).toBe(false);
    });

    it('should reject enrollment in completed course', () => {
      const course: Course = {
        courseId: 'course-1',
        tenantId: TEST_TENANT_UUID,
        courseCode: 'CS101',
        courseName: 'Intro to CS',
        credits: 3,
        status: 'completed',
        currentEnrollment: 15,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(canEnroll(course)).toBe(false);
    });
  });
});
