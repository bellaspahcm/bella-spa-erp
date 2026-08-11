/**
 * Enrollment Domain Types
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict typing)
 */

// ============================================================================
// Core Enums
// ============================================================================

export type EnrollmentStatus =
  | 'pending'       // Awaiting approval/payment
  | 'active'        // Currently enrolled
  | 'completed'     // Finished course successfully
  | 'withdrawn'     // Student withdrew
  | 'failed'        // Did not meet requirements
  | 'suspended';    // Temporarily suspended

export type GradeStatus =
  | 'not_graded'
  | 'in_progress'
  | 'graded'
  | 'pass'
  | 'fail';

// ============================================================================
// Enrollment Domain Types
// ============================================================================

/**
 * Enrollment - represents Student enrolled in a Course
 */
export interface Enrollment {
  // Primary key
  enrollmentId: string;
  
  // Tenant isolation
  tenantId: string;
  
  // Foreign keys (aggregate roots)
  studentId: string;  // References students table
  courseId: string;   // References courses table
  
  // Enrollment-specific fields
  enrollmentDate: string;      // ISO 8601 date
  completionDate?: string;     // When student completed/withdrew
  status: EnrollmentStatus;
  
  // Academic tracking
  grade?: string;              // Letter grade (A, B, C, etc.)
  gradePoints?: number;        // Numeric grade (0-100 or 0-4.0)
  gradeStatus: GradeStatus;
  creditsEarned?: number;      // Credits earned (0 if incomplete/failed)
  
  // Attendance
  attendancePercentage?: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Create Enrollment Request
 */
export interface CreateEnrollmentRequest {
  tenantId: string;
  studentId: string;
  courseId: string;
  enrollmentDate: string;
  status?: EnrollmentStatus;  // Defaults to 'pending'
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Update Enrollment Request
 */
export interface UpdateEnrollmentRequest {
  enrollmentId: string;
  tenantId: string;
  status?: EnrollmentStatus;
  grade?: string;
  gradePoints?: number;
  gradeStatus?: GradeStatus;
  creditsEarned?: number;
  attendancePercentage?: number;
  completionDate?: string;
  metadata?: Record<string, unknown>;
  updatedBy?: string;
}

// ============================================================================
// Database Schema Types
// ============================================================================

export interface EnrollmentsTableRow {
  id: string;
  tenant_id: string;
  student_id: string;
  course_id: string;
  enrollment_date: string;
  completion_date: string | null;
  status: EnrollmentStatus;
  grade: string | null;
  grade_points: number | null;
  grade_status: GradeStatus;
  credits_earned: number | null;
  attendance_percentage: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface EnrollmentsTableInsert {
  id?: string;
  tenant_id: string;
  student_id: string;
  course_id: string;
  enrollment_date: string;
  completion_date?: string | null;
  status?: EnrollmentStatus;
  grade?: string | null;
  grade_points?: number | null;
  grade_status?: GradeStatus;
  credits_earned?: number | null;
  attendance_percentage?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface EnrollmentsTableUpdate {
  status?: EnrollmentStatus;
  completion_date?: string | null;
  grade?: string | null;
  grade_points?: number | null;
  grade_status?: GradeStatus;
  credits_earned?: number | null;
  attendance_percentage?: number | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
  updated_by?: string | null;
}
