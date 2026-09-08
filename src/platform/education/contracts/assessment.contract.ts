/**
 * Education Assessment Contract
 * 
 * Contract definition for Assessment operations in Education Platform.
 * Defines API endpoints, events, and schemas for grading and GPA management.
 * 
 * @module platform/education/contracts/assessment
 */

// ============================================================================
// DTOs
// ============================================================================

export interface EducationAssessmentDTO {
  id: string;
  tenantId: string;
  enrollmentId: string;
  scoreType: 'quiz' | 'midterm' | 'final' | 'homework';
  grade: number;
  weight: number;
  occurredAt: string;
  createdAt: string;
  createdBy: string;
}

// ============================================================================
// Contract Interface
// ============================================================================

export interface IEducationAssessmentContract {
  /**
   * Record a score for an enrollment
   */
  recordScore(request: {
    tenantId: string;
    enrollmentId: string;
    scoreType: 'quiz' | 'midterm' | 'final' | 'homework';
    grade: number;
    weight: number;
    occurredAt?: string;
  }): Promise<{ success: boolean; data?: EducationAssessmentDTO; error?: string }>;

  /**
   * Get assessments for an enrollment
   */
  getAssessments(request: {
    tenantId: string;
    enrollmentId: string;
  }): Promise<{ success: boolean; data?: EducationAssessmentDTO[]; error?: string }>;

  /**
   * Calculate GPA for a student
   */
  calculateGPA(request: {
    tenantId: string;
    studentId: string;
  }): Promise<{ success: boolean; data?: { gpa: number }; error?: string }>;
}
