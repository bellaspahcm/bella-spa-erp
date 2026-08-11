/**
 * Course Service - Application Layer
 * 
 * Orchestrates Course aggregate + repository
 * 
 * Pattern: Inherited from StudentService
 */

import {
  createCourse as createCourseAggregate,
  updateCourse as updateCourseAggregate,
  activateCourse,
  startCourse,
  completeCourse,
  cancelCourse,
  archiveCourse,
} from './course.aggregate';
import { CourseRepository } from './course.repository';
import {
  Course,
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseFilters,
  CourseResult,
  CourseListResult,
} from '../shared-kernel/course-types';

export class CourseService {
  /**
   * Create new course
   */
  static async createCourse(request: CreateCourseRequest): Promise<CourseResult> {
    try {
      // Check if course code already exists
      const existing = await CourseRepository.findByCourseCode(request.courseCode, request.tenantId);
      if (existing) {
        return {
          success: false,
          error: `Course code ${request.courseCode} already exists in this tenant`,
        };
      }

      // Create aggregate
      const course = createCourseAggregate(request);

      // Persist
      const saved = await CourseRepository.create(course);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get course by ID
   */
  static async getCourseById(courseId: string, tenantId: string): Promise<CourseResult> {
    try {
      const course = await CourseRepository.findById(courseId, tenantId);
      
      if (!course) {
        return { success: false, error: 'Course not found' };
      }

      return { success: true, course };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get course by course code
   */
  static async getCourseByCourseCode(courseCode: string, tenantId: string): Promise<CourseResult> {
    try {
      const course = await CourseRepository.findByCourseCode(courseCode, tenantId);
      
      if (!course) {
        return { success: false, error: 'Course not found' };
      }

      return { success: true, course };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query courses
   */
  static async queryCourses(filters: CourseFilters): Promise<CourseListResult> {
    try {
      const courses = await CourseRepository.query(filters);

      return { success: true, courses, total: courses.length };
    } catch (error) {
      return {
        success: false,
        courses: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update course
   */
  static async updateCourse(request: UpdateCourseRequest): Promise<CourseResult> {
    try {
      // Get existing course
      const existing = await CourseRepository.findById(request.courseId, request.tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      // Apply updates via aggregate
      const updated = updateCourseAggregate(existing, request);

      // Persist
      const saved = await CourseRepository.update(updated);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Activate course
   */
  static async activateCourse(courseId: string, tenantId: string, userId: string): Promise<CourseResult> {
    try {
      const existing = await CourseRepository.findById(courseId, tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      const activated = activateCourse(existing, userId);
      const saved = await CourseRepository.update(activated);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start course
   */
  static async startCourse(courseId: string, tenantId: string, userId: string): Promise<CourseResult> {
    try {
      const existing = await CourseRepository.findById(courseId, tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      const started = startCourse(existing, userId);
      const saved = await CourseRepository.update(started);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete course
   */
  static async completeCourse(courseId: string, tenantId: string, userId: string): Promise<CourseResult> {
    try {
      const existing = await CourseRepository.findById(courseId, tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      const completed = completeCourse(existing, userId);
      const saved = await CourseRepository.update(completed);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel course
   */
  static async cancelCourse(courseId: string, tenantId: string, userId: string): Promise<CourseResult> {
    try {
      const existing = await CourseRepository.findById(courseId, tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      const cancelled = cancelCourse(existing, userId);
      const saved = await CourseRepository.update(cancelled);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive course
   */
  static async archiveCourse(courseId: string, tenantId: string, userId: string): Promise<CourseResult> {
    try {
      const existing = await CourseRepository.findById(courseId, tenantId);
      if (!existing) {
        return { success: false, error: 'Course not found' };
      }

      const archived = archiveCourse(existing, userId);
      const saved = await CourseRepository.update(archived);

      return { success: true, course: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
