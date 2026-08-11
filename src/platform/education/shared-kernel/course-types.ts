/**
 * Course Domain Types
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict typing)
 */

// ============================================================================
// Core Enums
// ============================================================================

export type CourseStatus =
  | 'draft'         // Being prepared
  | 'active'        // Open for enrollment
  | 'full'          // Capacity reached
  | 'in_progress'   // Course started
  | 'completed'     // Course finished
  | 'cancelled'     // Course cancelled
  | 'archived';     // No longer offered

export type CourseLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

// ============================================================================
// Course Domain Types
// ============================================================================

/**
 * Course - represents an educational course offering
 */
export interface Course {
  // Primary key
  courseId: string;
  
  // Tenant isolation
  tenantId: string;
  
  // Course identification
  courseCode: string;       // e.g., "CS101"
  courseName: string;       // e.g., "Introduction to Computer Science"
  description?: string;
  
  // Academic details
  credits: number;          // Credit hours (must be > 0)
  durationWeeks?: number;   // Course duration
  level?: CourseLevel;
  
  // Enrollment management
  maxStudents?: number;     // Maximum enrollment capacity
  minStudents?: number;     // Minimum required to run course
  currentEnrollment?: number; // Current enrolled count
  
  // Prerequisites
  prerequisiteCourseIds?: string[]; // Other courses required before enrollment
  
  // Status
  status: CourseStatus;
  
  // Schedule (optional - could be in separate table)
  startDate?: string;       // ISO 8601 date
  endDate?: string;         // ISO 8601 date
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // Audit fields
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;        // ISO 8601 timestamp
  createdBy: string;        // User UUID
  updatedBy?: string;       // User UUID
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Create Course Request
 */
export interface CreateCourseRequest {
  tenantId: string;
  courseCode: string;
  courseName: string;
  description?: string;
  credits: number;
  durationWeeks?: number;
  level?: CourseLevel;
  maxStudents?: number;
  minStudents?: number;
  prerequisiteCourseIds?: string[];
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

/**
 * Update Course Request
 */
export interface UpdateCourseRequest {
  courseId: string;
  tenantId: string;
  courseName?: string;
  description?: string;
  credits?: number;
  durationWeeks?: number;
  level?: CourseLevel;
  maxStudents?: number;
  minStudents?: number;
  status?: CourseStatus;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
  updatedBy: string;
}

/**
 * Course Query Filters
 */
export interface CourseFilters {
  tenantId: string;
  courseCode?: string;
  status?: CourseStatus;
  level?: CourseLevel;
  startDateFrom?: string;
  startDateTo?: string;
}

// ============================================================================
// Course Result Types
// ============================================================================

export interface CourseResult {
  success: boolean;
  course?: Course;
  error?: string;
}

export interface CourseListResult {
  success: boolean;
  courses: Course[];
  total: number;
  error?: string;
}
