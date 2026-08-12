/**
 * Education OS — Domain Unit Tests
 */

import { Course } from '../course.entity';
import { Enrollment } from '../enrollment.entity';

describe('Education OS — Domain Aggregates', () => {
  describe('Course Aggregate', () => {
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

  describe('Enrollment Aggregate', () => {
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
    });

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
  });
});
