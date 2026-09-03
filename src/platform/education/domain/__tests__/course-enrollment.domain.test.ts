/**
 * Education OS — Domain Unit Tests
 * 
 * Behavioral specification for Course and Enrollment aggregates.
 */

import { Course } from '../course.entity';
import { Enrollment } from '../enrollment.entity';

describe('Education OS — Domain Aggregates', () => {
  describe('Course Aggregate', () => {
    describe('Creation', () => {
      it('should create valid course and convert courseCode to uppercase', () => {
        const course = Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'cs-101',
          title: 'Introduction to Computer Science',
        });

        expect(course.id).toBeDefined();
        expect(course.courseCode).toBe('CS-101');
        expect(course.title).toBe('Introduction to Computer Science');
        expect(course.status).toBe('active');
      });

      it('should create course with max students capacity', () => {
        const course = Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-101',
          title: 'Intro CS',
          maxStudents: 30,
        });

        expect(course.maxStudents).toBe(30);
        expect(course.currentEnrollment).toBe(0);
      });

      it('should create course with unlimited capacity (null maxStudents)', () => {
        const course = Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-101',
          title: 'Intro CS',
          maxStudents: null,
        });

        expect(course.maxStudents).toBeNull();
        expect(course.currentEnrollment).toBe(0);
      });

      it('should create course with prerequisite course codes', () => {
        const course = Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-201',
          title: 'Advanced CS',
          prerequisiteCourseCodes: ['CS-101', 'MATH-101'],
        });

        expect(course.prerequisiteCourseCodes).toEqual(['CS-101', 'MATH-101']);
      });

      it('should reject course without tenantId', () => {
        expect(() => Course.create({
          tenantId: '',
          courseCode: 'CS-101',
          title: 'Intro CS',
        })).toThrow('Course requires tenantId');
      });

      it('should reject course without courseCode', () => {
        expect(() => Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: '',
          title: 'Intro CS',
        })).toThrow('Course requires courseCode');
      });

      it('should reject course without title', () => {
        expect(() => Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-101',
          title: '',
        })).toThrow('Course requires title');
      });
    });

    describe('Lifecycle', () => {
      it('should archive active course', () => {
        const course = Course.create({
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-101',
          title: 'Intro CS',
        });

        course.archive();
        expect(course.status).toBe('archived');
        expect(() => course.archive()).toThrow('Course is already archived');
      });
    });

    describe('Reconstitution', () => {
      it('should reconstitute course from persistence', () => {
        const now = new Date();
        const course = Course.reconstitute({
          id: 'course-123',
          tenantId: 'tenant-edu-1',
          courseCode: 'CS-101',
          title: 'Intro CS',
          status: 'active',
          maxStudents: 30,
          currentEnrollment: 15,
          prerequisiteCourseCodes: ['MATH-101'],
          createdAt: now,
          updatedAt: now,
        });

        expect(course.id).toBe('course-123');
        expect(course.courseCode).toBe('CS-101');
        expect(course.maxStudents).toBe(30);
        expect(course.currentEnrollment).toBe(15);
        expect(course.prerequisiteCourseCodes).toEqual(['MATH-101']);
      });
    });
  });

  describe('Enrollment Aggregate', () => {
    describe('Creation', () => {
      it('should create valid enrollment in pending status', () => {
        const enrollment = Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
        });

        expect(enrollment.id).toBeDefined();
        expect(enrollment.status).toBe('pending');
        expect(enrollment.studentPartyId).toBe('student-party-1');
        expect(enrollment.courseId).toBe('course-1');
        expect(enrollment.requestId).toBeDefined();
      });

      it('should create enrollment with explicit requestId for idempotency', () => {
        const requestId = 'request-123';
        const enrollment = Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
          requestId,
        });

        expect(enrollment.requestId).toBe(requestId);
      });

      it('should reject enrollment without tenantId', () => {
        expect(() => Enrollment.create({
          tenantId: '',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
        })).toThrow('Enrollment requires tenantId');
      });

      it('should reject enrollment without studentPartyId', () => {
        expect(() => Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: '',
          courseId: 'course-1',
        })).toThrow('Enrollment requires studentPartyId');
      });

      it('should reject enrollment without courseId', () => {
        expect(() => Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: '',
        })).toThrow('Enrollment requires courseId');
      });
    });

    describe('Lifecycle', () => {
      it('should handle lifecycle state machine correctly', () => {
        const enrollment = Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
        });

        enrollment.activate();
        expect(enrollment.status).toBe('active');

        enrollment.complete();
        expect(enrollment.status).toBe('completed');

        expect(() => enrollment.cancel()).toThrow('Completed enrollments cannot be cancelled');
      });

      it('should allow cancellation from pending status', () => {
        const enrollment = Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
        });

        enrollment.cancel();
        expect(enrollment.status).toBe('cancelled');
      });

      it('should allow cancellation from active status', () => {
        const enrollment = Enrollment.create({
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
        });

        enrollment.activate();
        enrollment.cancel();
        expect(enrollment.status).toBe('cancelled');
      });
    });

    describe('Reconstitution', () => {
      it('should reconstitute enrollment from persistence', () => {
        const now = new Date();
        const enrollment = Enrollment.reconstitute({
          id: 'enrollment-123',
          tenantId: 'tenant-edu-1',
          studentPartyId: 'student-party-1',
          courseId: 'course-1',
          status: 'active',
          enrolledAt: now,
          requestId: 'request-123',
          createdAt: now,
          updatedAt: now,
        });

        expect(enrollment.id).toBe('enrollment-123');
        expect(enrollment.status).toBe('active');
        expect(enrollment.requestId).toBe('request-123');
      });
    });
  });
});
