/**
 * Education Enrollment Contract
 * 
 * Contract definition for Enrollment operations in Education Platform.
 * Defines API endpoints, events, and schemas for student enrollment management.
 * 
 * @module platform/education/contracts/enrollment
 */

// ============================================================================
// DTOs
// ============================================================================

export interface EducationEnrollmentDTO {
  id: string;
  tenantId: string;
  studentId: string;
  courseId: string;
  classId?: string;
  academicYear: string;
  term: string;
  status: 'enrolled' | 'completed' | 'dropped' | 'withdrawn';
  enrolledAt: string;
  enrolledBy: string;
  completedAt?: string;
  finalGrade?: number;
}

// ============================================================================
// Contract Interface
// ============================================================================

export interface IEducationEnrollmentContract {
  /**
   * Enroll a student in a course
   */
  enrollStudent(request: {
    tenantId: string;
    studentId: string;
    courseId: string;
    classId?: string;
    academicYear: string;
    term: string;
  }): Promise<{ success: boolean; data?: EducationEnrollmentDTO; error?: string }>;

  /**
   * Get enrollment by ID
   */
  getEnrollment(request: {
    tenantId: string;
    enrollmentId: string;
  }): Promise<{ success: boolean; data?: EducationEnrollmentDTO; error?: string }>;

  /**
   * List enrollments for a student
   */
  listEnrollments(request: {
    tenantId: string;
    studentId?: string;
    courseId?: string;
    academicYear?: string;
    term?: string;
    status?: 'enrolled' | 'completed' | 'dropped' | 'withdrawn';
  }): Promise<{ success: boolean; data?: EducationEnrollmentDTO[]; error?: string }>;

  /**
   * Update enrollment status
   */
  updateEnrollmentStatus(request: {
    tenantId: string;
    enrollmentId: string;
    status: 'enrolled' | 'completed' | 'dropped' | 'withdrawn';
    finalGrade?: number;
  }): Promise<{ success: boolean; data?: EducationEnrollmentDTO; error?: string }>;

  /**
   * Drop enrollment
   */
  dropEnrollment(request: {
    tenantId: string;
    enrollmentId: string;
    reason?: string;
  }): Promise<{ success: boolean; data?: EducationEnrollmentDTO; error?: string }>;
}
