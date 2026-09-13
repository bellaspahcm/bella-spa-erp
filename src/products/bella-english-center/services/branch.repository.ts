/**
 * @fileoverview English Center Branch Repository
 * 
 * Repository layer for branch-specific academic queries.
 * Handles JOINs between org_units and education tables.
 * 
 * Architecture:
 * - Platform: org_units schema
 * - Product: branch_id mappings + academic queries
 * 
 * Usage:
 * - Server-side API routes: Pass createServiceClient() as parameter
 * - Client-side hooks: Pass createClient() as parameter
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface BranchAcademicSummary {
  branchId: string;
  tenantId: string;
  branchName: string;
  branchCode: string;
  totalEnrollments: number;
  totalStudents: number;
  totalCourses: number;
  activeEnrollments: number;
}

export interface BranchEnrollmentDetail {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  enrollmentDate: string;
  status: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class EnglishBranchRepository {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get branch academic summary
   * 
   * Uses v_branch_academic_summary view created by migration.
   */
  async getBranchSummary(
    branchId: string,
    tenantId: string
  ): Promise<BranchAcademicSummary | null> {
    const { data, error } = await this.supabase
      .from('v_branch_academic_summary')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      console.error('[BranchRepository] Failed to get summary:', error);
      return null;
    }

    if (!data) return null;

    return {
      branchId: data.branch_id,
      tenantId: data.tenant_id,
      branchName: data.branch_name,
      branchCode: data.branch_code,
      totalEnrollments: data.total_enrollments || 0,
      totalStudents: data.total_students || 0,
      totalCourses: data.total_courses || 0,
      activeEnrollments: data.active_enrollments || 0,
    };
  }

  /**
   * Get all branch summaries for tenant
   */
  async getAllBranchSummaries(tenantId: string): Promise<BranchAcademicSummary[]> {
    const { data, error } = await this.supabase
      .from('v_branch_academic_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('branch_name');

    if (error) {
      console.error('[BranchRepository] Failed to get summaries:', error);
      return [];
    }

    return (data || []).map((row) => ({
      branchId: row.branch_id,
      tenantId: row.tenant_id,
      branchName: row.branch_name,
      branchCode: row.branch_code,
      totalEnrollments: row.total_enrollments || 0,
      totalStudents: row.total_students || 0,
      totalCourses: row.total_courses || 0,
      activeEnrollments: row.active_enrollments || 0,
    }));
  }

  /**
   * Get enrollments at branch
   */
  async getBranchEnrollments(
    branchId: string,
    tenantId: string
  ): Promise<BranchEnrollmentDetail[]> {
    const { data, error } = await this.supabase
      .from('enrollments')
      .select(
        `
        enrollment_id,
        student_id,
        course_id,
        enrollment_date,
        status,
        students!inner(student_name),
        courses!inner(course_name)
      `
      )
      .eq('branch_id', branchId)
      .eq('tenant_id', tenantId)
      .order('enrollment_date', { ascending: false });

    if (error) {
      console.error('[BranchRepository] Failed to get enrollments:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      enrollmentId: row.enrollment_id,
      studentId: row.student_id,
      studentName: row.students?.student_name || 'Unknown',
      courseId: row.course_id,
      courseName: row.courses?.course_name || 'Unknown',
      enrollmentDate: row.enrollment_date,
      status: row.status,
    }));
  }

  /**
   * Get courses offered at branch
   */
  async getBranchCourses(branchId: string, tenantId: string) {
    const { data, error } = await this.supabase
      .from('courses')
      .select('*')
      .eq('branch_id', branchId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('course_name');

    if (error) {
      console.error('[BranchRepository] Failed to get courses:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Assign enrollment to branch
   * 
   * Called when student enrolls in course.
   */
  async assignEnrollmentToBranch(
    enrollmentId: string,
    branchId: string,
    tenantId: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('enrollments')
      .update({ branch_id: branchId })
      .eq('enrollment_id', enrollmentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[BranchRepository] Failed to assign enrollment:', error);
      return false;
    }

    return true;
  }

  /**
   * Assign course to branch
   * 
   * Called when course is created or moved to branch.
   */
  async assignCourseToBranch(
    courseId: string,
    branchId: string,
    tenantId: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('courses')
      .update({ branch_id: branchId })
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[BranchRepository] Failed to assign course:', error);
      return false;
    }

    return true;
  }
}
