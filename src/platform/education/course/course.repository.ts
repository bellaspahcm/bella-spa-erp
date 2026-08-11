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

type CoursesTableRow = Database['public']['Tables']['courses']['Row'];
type CoursesTableInsert = Database['public']['Tables']['courses']['Insert'];
type CoursesTableUpdate = Database['public']['Tables']['courses']['Update'];

export class CourseRepository {
  /**
   * Create new course
   */
  static async create(course: Course): Promise<Course> {
    const supabase = await createClient();

    const row: CoursesTableInsert = {
      tenant_id: course.tenantId,
      course_code: course.courseCode,
      course_name: course.courseName,
      description: course.description ?? null,
      credits: course.credits,
      duration_weeks: course.durationWeeks ?? null,
      status: course.status,
      metadata: course.metadata ?? null,
      created_by: course.createdBy,
    };

    const { data, error } = await supabase
      .from('courses')
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
      .from('courses')
      .select('*')
      .eq('id', courseId)
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
      .from('courses')
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
      .from('courses')
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.courseCode) {
      query = query.eq('course_code', filters.courseCode.toUpperCase());
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.level) {
      query = query.eq('level', filters.level);
    }

    if (filters.startDateFrom) {
      query = query.gte('start_date', filters.startDateFrom);
    }

    if (filters.startDateTo) {
      query = query.lte('start_date', filters.startDateTo);
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

    const row: CoursesTableUpdate = {
      course_name: course.courseName,
      description: course.description ?? null,
      credits: course.credits,
      duration_weeks: course.durationWeeks ?? null,
      status: course.status,
      metadata: course.metadata ?? null,
      updated_at: course.updatedAt,
      updated_by: course.updatedBy ?? null,
    };

    const { data, error } = await supabase
      .from('courses')
      .update(row)
      .eq('id', course.courseId)
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
      .from('courses')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', courseId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete course: ${error.message}`);
    }
  }

  /**
   * Map database row to domain model
   */
  private static mapRowToDomain(row: CoursesTableRow): Course {
    return {
      courseId: row.id,
      tenantId: row.tenant_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      description: row.description ?? undefined,
      credits: row.credits,
      durationWeeks: row.duration_weeks ?? undefined,
      status: row.status as Course['status'],
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by ?? '',
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
