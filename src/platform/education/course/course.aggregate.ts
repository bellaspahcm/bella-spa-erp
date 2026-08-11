/**
 * Course Aggregate
 * 
 * Business rules for Course entity
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types
 * - Aggregate-first domain modeling
 */

import {
  Course,
  CourseStatus,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '../shared-kernel/course-types';

// ============================================================================
// Course Aggregate Functions
// ============================================================================

/**
 * Create a new Course
 */
export function createCourse(request: CreateCourseRequest): Course {
  // Validation
  if (!request.courseCode || request.courseCode.trim().length === 0) {
    throw new Error('Course code is required');
  }
  
  if (!request.courseName || request.courseName.trim().length === 0) {
    throw new Error('Course name is required');
  }
  
  if (request.credits <= 0) {
    throw new Error('Credits must be greater than 0');
  }
  
  if (request.maxStudents !== undefined && request.maxStudents < 1) {
    throw new Error('Max students must be at least 1');
  }
  
  if (request.minStudents !== undefined && request.minStudents < 1) {
    throw new Error('Min students must be at least 1');
  }
  
  if (
    request.maxStudents !== undefined &&
    request.minStudents !== undefined &&
    request.minStudents > request.maxStudents
  ) {
    throw new Error('Min students cannot exceed max students');
  }
  
  // Date validation
  if (request.startDate && request.endDate) {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    if (start >= end) {
      throw new Error('End date must be after start date');
    }
  }
  
  const now = new Date().toISOString();
  
  return {
    courseId: '', // Will be set by database
    tenantId: request.tenantId,
    courseCode: request.courseCode.trim().toUpperCase(),
    courseName: request.courseName.trim(),
    description: request.description?.trim(),
    credits: request.credits,
    durationWeeks: request.durationWeeks,
    level: request.level,
    maxStudents: request.maxStudents,
    minStudents: request.minStudents,
    currentEnrollment: 0,
    prerequisiteCourseIds: request.prerequisiteCourseIds,
    status: 'draft', // New courses start as draft
    startDate: request.startDate,
    endDate: request.endDate,
    metadata: request.metadata,
    createdAt: now,
    updatedAt: now,
    createdBy: request.createdBy,
  };
}

/**
 * Update an existing Course
 */
export function updateCourse(
  existing: Course,
  request: UpdateCourseRequest
): Course {
  // Tenant isolation check
  if (existing.tenantId !== request.tenantId) {
    throw new Error('Cannot update course from different tenant');
  }
  
  // Validate updates
  if (request.credits !== undefined && request.credits <= 0) {
    throw new Error('Credits must be greater than 0');
  }
  
  if (request.maxStudents !== undefined && request.maxStudents < 1) {
    throw new Error('Max students must be at least 1');
  }
  
  if (request.minStudents !== undefined && request.minStudents < 1) {
    throw new Error('Min students must be at least 1');
  }
  
  const maxStudents = request.maxStudents ?? existing.maxStudents;
  const minStudents = request.minStudents ?? existing.minStudents;
  
  if (
    maxStudents !== undefined &&
    minStudents !== undefined &&
    minStudents > maxStudents
  ) {
    throw new Error('Min students cannot exceed max students');
  }
  
  // Date validation
  const startDate = request.startDate ?? existing.startDate;
  const endDate = request.endDate ?? existing.endDate;
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      throw new Error('End date must be after start date');
    }
  }
  
  return {
    ...existing,
    courseName: request.courseName?.trim() ?? existing.courseName,
    description: request.description?.trim() ?? existing.description,
    credits: request.credits ?? existing.credits,
    durationWeeks: request.durationWeeks ?? existing.durationWeeks,
    level: request.level ?? existing.level,
    maxStudents: request.maxStudents ?? existing.maxStudents,
    minStudents: request.minStudents ?? existing.minStudents,
    status: request.status ?? existing.status,
    startDate: request.startDate ?? existing.startDate,
    endDate: request.endDate ?? existing.endDate,
    metadata: request.metadata ?? existing.metadata,
    updatedAt: new Date().toISOString(),
    updatedBy: request.updatedBy,
  };
}

/**
 * Activate a course (make it open for enrollment)
 */
export function activateCourse(course: Course, userId: string): Course {
  if (course.status === 'cancelled') {
    throw new Error('Cannot activate cancelled course');
  }
  
  if (course.status === 'completed') {
    throw new Error('Cannot activate completed course');
  }
  
  if (course.status === 'active') {
    throw new Error('Course is already active');
  }
  
  return {
    ...course,
    status: 'active',
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Start a course (begin instruction)
 */
export function startCourse(course: Course, userId: string): Course {
  if (course.status !== 'active' && course.status !== 'full') {
    throw new Error('Can only start active or full courses');
  }
  
  if (course.minStudents !== undefined) {
    const enrolled = course.currentEnrollment ?? 0;
    if (enrolled < course.minStudents) {
      throw new Error(`Cannot start course: minimum ${course.minStudents} students required, only ${enrolled} enrolled`);
    }
  }
  
  return {
    ...course,
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Complete a course
 */
export function completeCourse(course: Course, userId: string): Course {
  if (course.status !== 'in_progress') {
    throw new Error('Can only complete courses that are in progress');
  }
  
  return {
    ...course,
    status: 'completed',
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Cancel a course
 */
export function cancelCourse(course: Course, userId: string): Course {
  if (course.status === 'completed') {
    throw new Error('Cannot cancel completed course');
  }
  
  if (course.status === 'cancelled') {
    throw new Error('Course is already cancelled');
  }
  
  return {
    ...course,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Archive a course
 */
export function archiveCourse(course: Course, userId: string): Course {
  if (course.status !== 'completed' && course.status !== 'cancelled') {
    throw new Error('Can only archive completed or cancelled courses');
  }
  
  return {
    ...course,
    status: 'archived',
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Update enrollment count (called when student enrolls/withdraws)
 */
export function updateEnrollmentCount(
  course: Course,
  newCount: number
): Course {
  if (newCount < 0) {
    throw new Error('Enrollment count cannot be negative');
  }
  
  // Check if course is now full
  let newStatus = course.status;
  if (
    course.maxStudents !== undefined &&
    newCount >= course.maxStudents &&
    course.status === 'active'
  ) {
    newStatus = 'full';
  }
  
  // Check if course has capacity again
  if (
    course.maxStudents !== undefined &&
    newCount < course.maxStudents &&
    course.status === 'full'
  ) {
    newStatus = 'active';
  }
  
  return {
    ...course,
    currentEnrollment: newCount,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if course is full
 */
export function isFull(course: Course): boolean {
  if (course.status === 'full') return true;
  
  if (course.maxStudents === undefined) return false;
  
  const enrolled = course.currentEnrollment ?? 0;
  return enrolled >= course.maxStudents;
}

/**
 * Check if course can accept new enrollments
 */
export function canEnroll(course: Course): boolean {
  if (course.status !== 'active' && course.status !== 'full') {
    return false;
  }
  
  return !isFull(course);
}
