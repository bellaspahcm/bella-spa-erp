/**
 * Education Course Contract
 * 
 * Contract definition for Course Catalog operations in Education Platform.
 * Defines API endpoints, events, and schemas for course management.
 * 
 * @module platform/education/contracts/course
 */

// ============================================================================
// DTOs
// ============================================================================

export interface EducationCourseDTO {
  id: string;
  tenantId: string;
  courseCode: string;
  courseName: string;
  description?: string;
  credits: number;
  department?: string;
  level?: string;
  prerequisites?: string[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

// ============================================================================
// Contract Interface
// ============================================================================

export interface IEducationCourseContract {
  /**
   * Create a new course
   */
  createCourse(request: {
    tenantId: string;
    courseCode: string;
    courseName: string;
    description?: string;
    credits: number;
    department?: string;
    level?: string;
    prerequisites?: string[];
  }): Promise<{ success: boolean; data?: EducationCourseDTO; error?: string }>;

  /**
   * Get course by ID
   */
  getCourse(request: {
    tenantId: string;
    courseId: string;
  }): Promise<{ success: boolean; data?: EducationCourseDTO; error?: string }>;

  /**
   * List courses
   */
  listCourses(request: {
    tenantId: string;
    department?: string;
    level?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; data?: EducationCourseDTO[]; error?: string }>;

  /**
   * Update course
   */
  updateCourse(request: {
    tenantId: string;
    courseId: string;
    updates: Partial<Omit<EducationCourseDTO, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>;
  }): Promise<{ success: boolean; data?: EducationCourseDTO; error?: string }>;
}
