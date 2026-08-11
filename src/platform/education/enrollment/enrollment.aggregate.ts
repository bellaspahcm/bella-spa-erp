/**
 * Enrollment Aggregate - Business Logic
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types
 */

import {
  Enrollment,
  CreateEnrollmentRequest,
  UpdateEnrollmentRequest,
  EnrollmentStatus,
  GradeStatus,
} from '../shared-kernel/enrollment-types';

export class EnrollmentAggregate {
  private enrollment: Enrollment;

  private constructor(enrollment: Enrollment) {
    this.enrollment = enrollment;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  static create(request: CreateEnrollmentRequest): EnrollmentAggregate {
    // Validate required fields
    if (!request.tenantId?.trim()) {
      throw new Error('Tenant ID is required');
    }
    if (!request.studentId?.trim()) {
      throw new Error('Student ID is required');
    }
    if (!request.courseId?.trim()) {
      throw new Error('Course ID is required');
    }

    // Validate enrollment date
    const enrollmentDate = new Date(request.enrollmentDate);
    if (isNaN(enrollmentDate.getTime())) {
      throw new Error('Invalid enrollment date format');
    }

    const now = new Date().toISOString();

    const enrollment: Enrollment = {
      enrollmentId: crypto.randomUUID(),
      tenantId: request.tenantId,
      studentId: request.studentId,
      courseId: request.courseId,
      enrollmentDate: request.enrollmentDate,
      status: request.status ?? 'pending',
      gradeStatus: 'not_graded',
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
      createdBy: request.createdBy,
    };

    return new EnrollmentAggregate(enrollment);
  }

  static fromDatabase(enrollment: Enrollment): EnrollmentAggregate {
    return new EnrollmentAggregate(enrollment);
  }

  // ============================================================================
  // Business Methods
  // ============================================================================

  update(request: UpdateEnrollmentRequest): EnrollmentAggregate {
    if (request.tenantId !== this.enrollment.tenantId) {
      throw new Error('Cannot change enrollment tenant');
    }
    if (request.enrollmentId !== this.enrollment.enrollmentId) {
      throw new Error('Enrollment ID mismatch');
    }

    // Validate grade points
    if (request.gradePoints !== undefined) {
      if (request.gradePoints < 0 || request.gradePoints > 100) {
        throw new Error('Grade points must be between 0 and 100');
      }
    }

    // Validate credits earned
    if (request.creditsEarned !== undefined && request.creditsEarned < 0) {
      throw new Error('Credits earned cannot be negative');
    }

    // Validate attendance percentage
    if (request.attendancePercentage !== undefined) {
      if (request.attendancePercentage < 0 || request.attendancePercentage > 100) {
        throw new Error('Attendance percentage must be between 0 and 100');
      }
    }

    const updatedEnrollment: Enrollment = {
      ...this.enrollment,
      status: request.status ?? this.enrollment.status,
      grade: request.grade ?? this.enrollment.grade,
      gradePoints: request.gradePoints ?? this.enrollment.gradePoints,
      gradeStatus: request.gradeStatus ?? this.enrollment.gradeStatus,
      creditsEarned: request.creditsEarned ?? this.enrollment.creditsEarned,
      attendancePercentage: request.attendancePercentage ?? this.enrollment.attendancePercentage,
      completionDate: request.completionDate ?? this.enrollment.completionDate,
      metadata: request.metadata ?? this.enrollment.metadata,
      updatedAt: new Date().toISOString(),
      updatedBy: request.updatedBy,
    };

    return new EnrollmentAggregate(updatedEnrollment);
  }

  activate(updatedBy?: string): EnrollmentAggregate {
    if (this.enrollment.status !== 'pending') {
      throw new Error('Only pending enrollments can be activated');
    }

    const updatedEnrollment: Enrollment = {
      ...this.enrollment,
      status: 'active',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new EnrollmentAggregate(updatedEnrollment);
  }

  complete(completionDate: string, updatedBy?: string): EnrollmentAggregate {
    if (this.enrollment.status !== 'active') {
      throw new Error('Only active enrollments can be completed');
    }

    const compDate = new Date(completionDate);
    if (isNaN(compDate.getTime())) {
      throw new Error('Invalid completion date format');
    }

    const enrollDate = new Date(this.enrollment.enrollmentDate);
    if (compDate < enrollDate) {
      throw new Error('Completion date cannot be before enrollment date');
    }

    const updatedEnrollment: Enrollment = {
      ...this.enrollment,
      status: 'completed',
      completionDate,
      gradeStatus: this.enrollment.gradeStatus === 'not_graded' ? 'graded' : this.enrollment.gradeStatus,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new EnrollmentAggregate(updatedEnrollment);
  }

  withdraw(completionDate: string, updatedBy?: string): EnrollmentAggregate {
    if (this.enrollment.status === 'completed') {
      throw new Error('Cannot withdraw completed enrollment');
    }

    const withdrawDate = new Date(completionDate);
    if (isNaN(withdrawDate.getTime())) {
      throw new Error('Invalid withdrawal date format');
    }

    const updatedEnrollment: Enrollment = {
      ...this.enrollment,
      status: 'withdrawn',
      completionDate,
      creditsEarned: 0,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new EnrollmentAggregate(updatedEnrollment);
  }

  assignGrade(grade: string, gradePoints: number, creditsEarned: number, updatedBy?: string): EnrollmentAggregate {
    if (this.enrollment.status !== 'active' && this.enrollment.status !== 'completed') {
      throw new Error('Can only grade active or completed enrollments');
    }

    if (gradePoints < 0 || gradePoints > 100) {
      throw new Error('Grade points must be between 0 and 100');
    }

    if (creditsEarned < 0) {
      throw new Error('Credits earned cannot be negative');
    }

    const gradeStatus: GradeStatus = gradePoints >= 50 ? 'pass' : 'fail';

    const updatedEnrollment: Enrollment = {
      ...this.enrollment,
      grade,
      gradePoints,
      gradeStatus,
      creditsEarned,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new EnrollmentAggregate(updatedEnrollment);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  getEnrollment(): Enrollment {
    return { ...this.enrollment };
  }

  getStatus(): EnrollmentStatus {
    return this.enrollment.status;
  }

  isActive(): boolean {
    return this.enrollment.status === 'active';
  }

  isCompleted(): boolean {
    return this.enrollment.status === 'completed';
  }

  isPending(): boolean {
    return this.enrollment.status === 'pending';
  }

  hasGrade(): boolean {
    return this.enrollment.gradeStatus === 'graded' || this.enrollment.gradeStatus === 'pass' || this.enrollment.gradeStatus === 'fail';
  }

  getGrade(): { grade?: string; gradePoints?: number; status: GradeStatus } {
    return {
      grade: this.enrollment.grade,
      gradePoints: this.enrollment.gradePoints,
      status: this.enrollment.gradeStatus,
    };
  }
}
