/**
 * Student Aggregate - Education Platform
 * 
 * Business rules and validation for Student entity
 * References Person aggregate for identity
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types
 * - Law 1: Student references Person (aggregate root)
 */

import { Student, CreateStudentRequest, UpdateStudentRequest, AcademicStatus } from '../shared-kernel/types';

export class StudentAggregate {
  private student: Student;

  private constructor(student: Student) {
    this.student = student;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Create new Student
   * Validates business rules before creation
   */
  static create(request: CreateStudentRequest): StudentAggregate {
    // Validate required fields
    if (!request.tenantId?.trim()) {
      throw new Error('Tenant ID is required');
    }
    if (!request.personId?.trim()) {
      throw new Error('Person ID is required (Student must reference a Person)');
    }
    if (!request.studentCode?.trim()) {
      throw new Error('Student code is required');
    }
    if (!request.programId?.trim()) {
      throw new Error('Program ID is required');
    }

    // Validate enrollment date
    const enrollmentDate = new Date(request.enrollmentDate);
    if (isNaN(enrollmentDate.getTime())) {
      throw new Error('Invalid enrollment date format');
    }

    // Validate expected graduation date (if provided)
    if (request.expectedGraduationDate) {
      const expectedGradDate = new Date(request.expectedGraduationDate);
      if (isNaN(expectedGradDate.getTime())) {
        throw new Error('Invalid expected graduation date format');
      }
      if (expectedGradDate <= enrollmentDate) {
        throw new Error('Expected graduation date must be after enrollment date');
      }
    }

    // Normalize student code (uppercase before validation)
    const normalizedCode = request.studentCode.trim().toUpperCase();

    // Validate student code format (EDU-YYYY-NNN)
    const codePattern = /^EDU-\d{4}-\d{3,}$/;
    if (!codePattern.test(normalizedCode)) {
      throw new Error('Invalid student code format (expected: EDU-YYYY-NNN)');
    }

    const now = new Date().toISOString();

    const student: Student = {
      studentId: crypto.randomUUID(),
      tenantId: request.tenantId,
      personId: request.personId,
      studentCode: normalizedCode,
      academicStatus: request.academicStatus,
      enrollmentType: request.enrollmentType,
      programId: request.programId,
      enrollmentDate: request.enrollmentDate,
      expectedGraduationDate: request.expectedGraduationDate,
      currentLevel: request.currentLevel,
      emergencyContactName: request.emergencyContactName,
      emergencyContactPhone: request.emergencyContactPhone,
      emergencyContactRelationship: request.emergencyContactRelationship,
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
      createdBy: request.createdBy,
    };

    return new StudentAggregate(student);
  }

  /**
   * Reconstitute Student from database
   */
  static fromDatabase(student: Student): StudentAggregate {
    return new StudentAggregate(student);
  }

  // ============================================================================
  // Business Methods
  // ============================================================================

  /**
   * Update student information
   */
  update(request: UpdateStudentRequest): StudentAggregate {
    // Validate tenant consistency
    if (request.tenantId !== this.student.tenantId) {
      throw new Error('Cannot change student tenant');
    }

    // Validate student ID consistency
    if (request.studentId !== this.student.studentId) {
      throw new Error('Student ID mismatch');
    }

    // Validate expected graduation date
    if (request.expectedGraduationDate) {
      const expectedGradDate = new Date(request.expectedGraduationDate);
      const enrollmentDate = new Date(this.student.enrollmentDate);
      if (expectedGradDate <= enrollmentDate) {
        throw new Error('Expected graduation date must be after enrollment date');
      }
    }

    // Validate actual graduation date
    if (request.actualGraduationDate) {
      const actualGradDate = new Date(request.actualGraduationDate);
      const enrollmentDate = new Date(this.student.enrollmentDate);
      if (actualGradDate < enrollmentDate) {
        throw new Error('Actual graduation date cannot be before enrollment date');
      }
    }

    // Validate GPA
    if (request.gpa !== undefined && (request.gpa < 0 || request.gpa > 4.0)) {
      throw new Error('GPA must be between 0 and 4.0');
    }

    // Validate total credits
    if (request.totalCredits !== undefined && request.totalCredits < 0) {
      throw new Error('Total credits cannot be negative');
    }

    const updatedStudent: Student = {
      ...this.student,
      academicStatus: request.academicStatus ?? this.student.academicStatus,
      enrollmentType: request.enrollmentType ?? this.student.enrollmentType,
      programId: request.programId ?? this.student.programId,
      currentLevel: request.currentLevel ?? this.student.currentLevel,
      gpa: request.gpa ?? this.student.gpa,
      totalCredits: request.totalCredits ?? this.student.totalCredits,
      expectedGraduationDate: request.expectedGraduationDate ?? this.student.expectedGraduationDate,
      actualGraduationDate: request.actualGraduationDate ?? this.student.actualGraduationDate,
      emergencyContactName: request.emergencyContactName ?? this.student.emergencyContactName,
      emergencyContactPhone: request.emergencyContactPhone ?? this.student.emergencyContactPhone,
      emergencyContactRelationship: request.emergencyContactRelationship ?? this.student.emergencyContactRelationship,
      metadata: request.metadata ?? this.student.metadata,
      updatedAt: new Date().toISOString(),
      updatedBy: request.updatedBy,
    };

    return new StudentAggregate(updatedStudent);
  }

  /**
   * Mark student as graduated
   */
  markGraduated(graduationDate: string, updatedBy?: string): StudentAggregate {
    const gradDate = new Date(graduationDate);
    if (isNaN(gradDate.getTime())) {
      throw new Error('Invalid graduation date format');
    }

    const enrollmentDate = new Date(this.student.enrollmentDate);
    if (gradDate < enrollmentDate) {
      throw new Error('Graduation date cannot be before enrollment date');
    }

    if (this.student.academicStatus === 'graduated') {
      throw new Error('Student is already graduated');
    }

    const updatedStudent: Student = {
      ...this.student,
      academicStatus: 'graduated',
      actualGraduationDate: graduationDate,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new StudentAggregate(updatedStudent);
  }

  /**
   * Put student on leave
   */
  putOnLeave(updatedBy?: string): StudentAggregate {
    if (this.student.academicStatus === 'graduated') {
      throw new Error('Cannot put graduated student on leave');
    }
    if (this.student.academicStatus === 'on_leave') {
      throw new Error('Student is already on leave');
    }

    const updatedStudent: Student = {
      ...this.student,
      academicStatus: 'on_leave',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new StudentAggregate(updatedStudent);
  }

  /**
   * Reinstate student from leave
   */
  reinstateFromLeave(updatedBy?: string): StudentAggregate {
    if (this.student.academicStatus !== 'on_leave') {
      throw new Error('Student is not on leave');
    }

    const updatedStudent: Student = {
      ...this.student,
      academicStatus: 'enrolled',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new StudentAggregate(updatedStudent);
  }

  /**
   * Update GPA and credits
   */
  updateAcademicProgress(gpa: number, totalCredits: number, updatedBy?: string): StudentAggregate {
    if (gpa < 0 || gpa > 4.0) {
      throw new Error('GPA must be between 0 and 4.0');
    }
    if (totalCredits < 0) {
      throw new Error('Total credits cannot be negative');
    }

    const updatedStudent: Student = {
      ...this.student,
      gpa,
      totalCredits,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    return new StudentAggregate(updatedStudent);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  getStudent(): Student {
    return { ...this.student };
  }

  getStudentCode(): string {
    return this.student.studentCode;
  }

  getAcademicStatus(): AcademicStatus {
    return this.student.academicStatus;
  }

  isEnrolled(): boolean {
    return this.student.academicStatus === 'enrolled';
  }

  isGraduated(): boolean {
    return this.student.academicStatus === 'graduated';
  }

  isOnLeave(): boolean {
    return this.student.academicStatus === 'on_leave';
  }

  getGPA(): number | undefined {
    return this.student.gpa;
  }

  getTotalCredits(): number | undefined {
    return this.student.totalCredits;
  }
}
