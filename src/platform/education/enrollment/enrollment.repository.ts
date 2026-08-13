/**
 * Enrollment Repository - Database Access
 */

import { createClient } from '@/lib/supabase-server';
import {
  Enrollment,
  EnrollmentsTableInsert,
  EnrollmentsTableUpdate,
  EnrollmentsTableRow,
} from '../shared-kernel/enrollment-types';

export class EnrollmentRepository {
  static async create(enrollment: Enrollment): Promise<Enrollment> {
    const supabase = await createClient();

    const row: EnrollmentsTableInsert = {
      enrollment_id: enrollment.enrollmentId,
      tenant_id: enrollment.tenantId,
      student_id: enrollment.studentId,
      course_id: enrollment.courseId,
      enrollment_date: enrollment.enrollmentDate,
      completion_date: enrollment.completionDate ?? null,
      status: enrollment.status,
      grade: enrollment.grade ?? null,
      grade_points: enrollment.gradePoints ?? null,
      grade_status: enrollment.gradeStatus,
      credits_earned: enrollment.creditsEarned ?? null,
      attendance_percentage: enrollment.attendancePercentage ?? null,
      metadata: enrollment.metadata ?? null,
      created_at: enrollment.createdAt,
      updated_at: enrollment.updatedAt,
      created_by: enrollment.createdBy ?? null,
      updated_by: enrollment.updatedBy ?? null,
    };

    const { data, error } = await supabase.from('enrollments').insert(row).select().single();

    if (error) {
      if (error.code === '23503') {
        if (error.message.includes('student_id') || error.message.includes('student_fk')) {
          throw new Error(`Student with ID ${enrollment.studentId} does not exist`);
        }
        if (error.message.includes('course_id') || error.message.includes('course_fk')) {
          throw new Error(`Course with ID ${enrollment.courseId} does not exist`);
        }
      }
      if (error.code === '23505') {
        throw new Error('Student already enrolled in this course');
      }
      throw new Error(`Failed to create enrollment: ${error.message}`);
    }

    return this.mapRowToDomain(data as EnrollmentsTableRow);
  }

  static async findById(enrollmentId: string, tenantId: string): Promise<Enrollment | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find enrollment: ${error.message}`);
    }

    return this.mapRowToDomain(data as EnrollmentsTableRow);
  }

  static async findByStudent(studentId: string, tenantId: string): Promise<Enrollment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('enrollment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to find enrollments: ${error.message}`);
    }

    return (data as EnrollmentsTableRow[]).map(this.mapRowToDomain);
  }

  static async findByCourse(courseId: string, tenantId: string): Promise<Enrollment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .order('enrollment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to find enrollments: ${error.message}`);
    }

    return (data as EnrollmentsTableRow[]).map(this.mapRowToDomain);
  }

  static async update(enrollment: Enrollment): Promise<Enrollment> {
    const supabase = await createClient();

    const updateData: EnrollmentsTableUpdate = {
      status: enrollment.status,
      completion_date: enrollment.completionDate ?? null,
      grade: enrollment.grade ?? null,
      grade_points: enrollment.gradePoints ?? null,
      grade_status: enrollment.gradeStatus,
      credits_earned: enrollment.creditsEarned ?? null,
      attendance_percentage: enrollment.attendancePercentage ?? null,
      metadata: enrollment.metadata ?? null,
      updated_at: enrollment.updatedAt,
      updated_by: enrollment.updatedBy ?? null,
    };

    const { data, error } = await supabase
      .from('enrollments')
      .update(updateData)
      .eq('enrollment_id', enrollment.enrollmentId)
      .eq('tenant_id', enrollment.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update enrollment: ${error.message}`);
    }

    if (!data) {
      throw new Error('Enrollment not found or tenant mismatch');
    }

    return this.mapRowToDomain(data as EnrollmentsTableRow);
  }

  static async delete(enrollmentId: string, tenantId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('enrollment_id', enrollmentId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete enrollment: ${error.message}`);
    }
  }

  private static mapRowToDomain(row: EnrollmentsTableRow): Enrollment {
    return {
      enrollmentId: row.enrollment_id,
      tenantId: row.tenant_id,
      studentId: row.student_id,
      courseId: row.course_id,
      enrollmentDate: row.enrollment_date,
      completionDate: row.completion_date ?? undefined,
      status: row.status,
      grade: row.grade ?? undefined,
      gradePoints: row.grade_points ?? undefined,
      gradeStatus: row.grade_status,
      creditsEarned: row.credits_earned ?? undefined,
      attendancePercentage: row.attendance_percentage ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
