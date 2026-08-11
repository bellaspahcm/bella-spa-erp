/**
 * Enrollment Aggregate Unit Tests
 */

import { EnrollmentAggregate } from '../enrollment.aggregate';
import { CreateEnrollmentRequest } from '../../shared-kernel/enrollment-types';

describe('EnrollmentAggregate', () => {
  const validRequest: CreateEnrollmentRequest = {
    tenantId: 'tenant-123',
    studentId: 'student-456',
    courseId: 'course-789',
    enrollmentDate: '2024-09-01',
    createdBy: 'admin-001',
  };

  describe('create', () => {
    it('should create enrollment with valid data', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const enrollment = aggregate.getEnrollment();

      expect(enrollment.tenantId).toBe('tenant-123');
      expect(enrollment.studentId).toBe('student-456');
      expect(enrollment.courseId).toBe('course-789');
      expect(enrollment.enrollmentDate).toBe('2024-09-01');
      expect(enrollment.status).toBe('pending');
      expect(enrollment.gradeStatus).toBe('not_graded');
      expect(enrollment.enrollmentId).toBeTruthy();
    });

    it('should throw error if tenant ID missing', () => {
      expect(() => EnrollmentAggregate.create({ ...validRequest, tenantId: '' })).toThrow('Tenant ID is required');
    });

    it('should throw error if student ID missing', () => {
      expect(() => EnrollmentAggregate.create({ ...validRequest, studentId: '' })).toThrow('Student ID is required');
    });

    it('should throw error if course ID missing', () => {
      expect(() => EnrollmentAggregate.create({ ...validRequest, courseId: '' })).toThrow('Course ID is required');
    });

    it('should throw error if invalid enrollment date', () => {
      expect(() => EnrollmentAggregate.create({ ...validRequest, enrollmentDate: 'invalid' })).toThrow('Invalid enrollment date');
    });
  });

  describe('update', () => {
    it('should update enrollment with valid data', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const enrollment = aggregate.getEnrollment();

      const updated = aggregate.update({
        enrollmentId: enrollment.enrollmentId,
        tenantId: enrollment.tenantId,
        gradePoints: 85,
        attendancePercentage: 90,
      });

      const updatedEnrollment = updated.getEnrollment();
      expect(updatedEnrollment.gradePoints).toBe(85);
      expect(updatedEnrollment.attendancePercentage).toBe(90);
    });

    it('should throw error if tenant mismatch', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const enrollment = aggregate.getEnrollment();

      expect(() =>
        aggregate.update({
          enrollmentId: enrollment.enrollmentId,
          tenantId: 'different-tenant',
        })
      ).toThrow('Cannot change enrollment tenant');
    });

    it('should throw error if invalid grade points', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const enrollment = aggregate.getEnrollment();

      expect(() =>
        aggregate.update({
          enrollmentId: enrollment.enrollmentId,
          tenantId: enrollment.tenantId,
          gradePoints: 150,
        })
      ).toThrow('Grade points must be between 0 and 100');
    });

    it('should throw error if negative credits', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const enrollment = aggregate.getEnrollment();

      expect(() =>
        aggregate.update({
          enrollmentId: enrollment.enrollmentId,
          tenantId: enrollment.tenantId,
          creditsEarned: -5,
        })
      ).toThrow('Credits earned cannot be negative');
    });
  });

  describe('activate', () => {
    it('should activate pending enrollment', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();

      expect(activated.getStatus()).toBe('active');
      expect(activated.isActive()).toBe(true);
    });

    it('should throw error if not pending', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();

      expect(() => activated.activate()).toThrow('Only pending enrollments can be activated');
    });
  });

  describe('complete', () => {
    it('should complete active enrollment', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();
      const completed = activated.complete('2024-12-15');

      expect(completed.getStatus()).toBe('completed');
      expect(completed.isCompleted()).toBe(true);
      expect(completed.getEnrollment().completionDate).toBe('2024-12-15');
    });

    it('should throw error if not active', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      expect(() => aggregate.complete('2024-12-15')).toThrow('Only active enrollments can be completed');
    });

    it('should throw error if completion before enrollment', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();

      expect(() => activated.complete('2024-08-01')).toThrow('Completion date cannot be before enrollment date');
    });
  });

  describe('withdraw', () => {
    it('should withdraw enrollment', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();
      const withdrawn = activated.withdraw('2024-10-15');

      expect(withdrawn.getStatus()).toBe('withdrawn');
      expect(withdrawn.getEnrollment().creditsEarned).toBe(0);
    });

    it('should throw error if already completed', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();
      const completed = activated.complete('2024-12-15');

      expect(() => completed.withdraw('2024-12-20')).toThrow('Cannot withdraw completed enrollment');
    });
  });

  describe('assignGrade', () => {
    it('should assign grade to active enrollment', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();
      const graded = activated.assignGrade('A', 90, 3);

      const grade = graded.getGrade();
      expect(grade.grade).toBe('A');
      expect(grade.gradePoints).toBe(90);
      expect(grade.status).toBe('pass');
      expect(graded.getEnrollment().creditsEarned).toBe(3);
    });

    it('should mark as fail if grade below 50', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();
      const graded = activated.assignGrade('F', 40, 0);

      const grade = graded.getGrade();
      expect(grade.status).toBe('fail');
    });

    it('should throw error if invalid grade points', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      const activated = aggregate.activate();

      expect(() => activated.assignGrade('A', 150, 3)).toThrow('Grade points must be between 0 and 100');
    });

    it('should throw error if not active/completed', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      expect(() => aggregate.assignGrade('A', 90, 3)).toThrow('Can only grade active or completed enrollments');
    });
  });

  describe('query methods', () => {
    it('should check status correctly', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      expect(aggregate.isPending()).toBe(true);
      expect(aggregate.isActive()).toBe(false);

      const activated = aggregate.activate();
      expect(activated.isPending()).toBe(false);
      expect(activated.isActive()).toBe(true);
    });

    it('should check grade status', () => {
      const aggregate = EnrollmentAggregate.create(validRequest);
      expect(aggregate.hasGrade()).toBe(false);

      const activated = aggregate.activate();
      const graded = activated.assignGrade('B', 80, 3);
      expect(graded.hasGrade()).toBe(true);
    });
  });
});
