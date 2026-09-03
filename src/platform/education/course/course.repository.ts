/**
 * Course Repository - Database Access Layer
 * 
 * Responsibilities:
 * - CRUD operations on courses table
 * - Tenant isolation enforcement
 * - Database row <-> Domain model mapping
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict Supabase types)
 * - Law 2: No direct DB access from product packs (this is Platform layer)
 * 
 * Pattern: Inherited from StudentRepository
 */

import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { Course, CourseFilters } from '../shared-kernel/course-types';

type CoursesTableRow = Database['public']['Tables']['edu_courses']['Row'];
type CoursesTableInsert = Database['public']['Tables']['edu_courses']['Insert'];
type CoursesTableUpdate = Database['public']['Tables']['edu_courses']['Update'];

export class CourseRepository {
  /**
   * Create new course
   */
  static async create(course: Course): Promise<Course> {
    const supabase = await createClient();

    const metadata = {
      ...((course.metadata as Record<string, unknown>) || {}),
      current_enrollment: course.currentEnrollment ?? 0,
      max_students: course.maxStudents ?? null,
      min_students: course.minStudents ?? null,
      prerequisite_course_ids: course.prerequisiteCourseIds ?? [],
      start_date: course.startDate ?? null,
      end_date: course.endDate ?? null,
      level: course.level ?? null,
    };

    const row: CoursesTableInsert = {
      tenant_id: course.tenantId,
      course_code: course.courseCode,
      course_name: course.courseName,
      description: course.description ?? null,
      credits: course.credits,
      duration_weeks: course.durationWeeks ?? null,
      status: course.status,
      metadata: metadata,
      created_by: course.createdBy,
    };

    const { data, error } = await supabase
      .from('edu_courses')
      .insert(row)
      .select()
      .single();

    if (error) {
      // Check unique constraint violation (course_code duplicate in tenant)
      if (error.code === '23505' && error.message.includes('course_code')) {
        throw new Error(`Course code ${course.courseCode} already exists in this tenant`);
      }
      throw new Error(`Failed to create course: ${error.message}`);
    }

    return this.mapRowToDomain(data as CoursesTableRow);
  }

  /**
   * Find course by ID (with tenant isolation)
   */
  static async findById(courseId: string, tenantId: string): Promise<Course | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('edu_courses')
      .select('*')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find course: ${error.message}`);
    }

    return this.mapRowToDomain(data as CoursesTableRow);
  }

  /**
   * Find course by course code (with tenant isolation)
   */
  static async findByCourseCode(courseCode: string, tenantId: string): Promise<Course | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('edu_courses')
      .select('*')
      .eq('course_code', courseCode.toUpperCase())
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find course: ${error.message}`);
    }

    return this.mapRowToDomain(data as CoursesTableRow);
  }

  /**
   * Query courses with filters (with tenant isolation)
   */
  static async query(filters: CourseFilters): Promise<Course[]> {
    const supabase = await createClient();

    let query = supabase
      .from('edu_courses')
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.courseCode) {
      query = query.eq('course_code', filters.courseCode.toUpperCase());
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.level) {
      query = query.eq('metadata->>level', filters.level);
    }

    if (filters.startDateFrom) {
      query = query.gte('metadata->>start_date', filters.startDateFrom);
    }

    if (filters.startDateTo) {
      query = query.lte('metadata->>start_date', filters.startDateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query courses: ${error.message}`);
    }

    return (data as CoursesTableRow[]).map(this.mapRowToDomain);
  }

  /**
   * Update course
   */
  static async update(course: Course): Promise<Course> {
    const supabase = await createClient();

    const metadata = {
      ...((course.metadata as Record<string, unknown>) || {}),
      current_enrollment: course.currentEnrollment ?? 0,
      max_students: course.maxStudents ?? null,
      min_students: course.minStudents ?? null,
      prerequisite_course_ids: course.prerequisiteCourseIds ?? [],
      start_date: course.startDate ?? null,
      end_date: course.endDate ?? null,
      level: course.level ?? null,
    };

    const row: CoursesTableUpdate = {
      course_name: course.courseName,
      description: course.description ?? null,
      credits: course.credits,
      duration_weeks: course.durationWeeks ?? null,
      status: course.status,
      metadata: metadata,
      updated_at: course.updatedAt,
      updated_by: course.updatedBy ?? null,
    };

    const { data, error } = await supabase
      .from('edu_courses')
      .update(row)
      .eq('course_id', course.courseId)
      .eq('tenant_id', course.tenantId) // Tenant isolation
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update course: ${error.message}`);
    }

    if (!data) {
      throw new Error('Course not found or not in same tenant');
    }

    return this.mapRowToDomain(data as CoursesTableRow);
  }

  /**
   * Delete course (soft delete - archive)
   */
  static async delete(courseId: string, tenantId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('edu_courses')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete course: ${error.message}`);
    }
  }

  /**
   * Map database row to domain model
   */
  private static mapRowToDomain(row: CoursesTableRow): Course {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    return {
      courseId: row.course_id,
      tenantId: row.tenant_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      description: row.description ?? undefined,
      credits: row.credits,
      durationWeeks: row.duration_weeks ?? undefined,
      status: row.status as Course['status'],
      currentEnrollment: meta.current_enrollment ?? 0,
      maxStudents: meta.max_students ?? undefined,
      minStudents: meta.min_students ?? undefined,
      prerequisiteCourseIds: meta.prerequisite_course_ids ?? [],
      startDate: meta.start_date ?? undefined,
      endDate: meta.end_date ?? undefined,
      level: meta.level ?? undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by ?? '',
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
