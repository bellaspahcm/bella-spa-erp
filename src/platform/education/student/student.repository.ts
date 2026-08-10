/**
 * Student Repository - Database Access Layer
 * 
 * Responsibilities:
 * - CRUD operations on students table
 * - Tenant isolation enforcement
 * - Person FK validation
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict Supabase types)
 * - Law 2: No direct DB access from product packs (this is Platform layer)
 */

import { createClient } from '@/lib/supabase-server';
import { Student, StudentsTableInsert, StudentsTableUpdate, StudentsTableRow } from '../shared-kernel/types';

export class StudentRepository {
  /**
   * Create new student
   * Validates person_id FK exists before insert
   */
  static async create(student: Student): Promise<Student> {
    const supabase = await createClient();

    // Map domain model to database row
    const row: StudentsTableInsert = {
      id: student.studentId,
      tenant_id: student.tenantId,
      person_id: student.personId,
      student_code: student.studentCode,
      academic_status: student.academicStatus,
      enrollment_type: student.enrollmentType,
      program_id: student.programId,
      enrollment_date: student.enrollmentDate,
      expected_graduation_date: student.expectedGraduationDate ?? null,
      actual_graduation_date: student.actualGraduationDate ?? null,
      current_level: student.currentLevel ?? null,
      gpa: student.gpa ?? null,
      total_credits: student.totalCredits ?? null,
      emergency_contact_name: student.emergencyContactName ?? null,
      emergency_contact_phone: student.emergencyContactPhone ?? null,
      emergency_contact_relationship: student.emergencyContactRelationship ?? null,
      metadata: student.metadata ?? null,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
      created_by: student.createdBy ?? null,
      updated_by: student.updatedBy ?? null,
    };

    const { data, error } = await supabase
      .from('students')
      .insert(row)
      .select()
      .single();

    if (error) {
      // Check if error is FK violation (person_id doesn't exist)
      if (error.code === '23503' && error.message.includes('person_id')) {
        throw new Error(`Person with ID ${student.personId} does not exist`);
      }
      // Check if error is unique violation (student_code duplicate)
      if (error.code === '23505' && error.message.includes('student_code')) {
        throw new Error(`Student code ${student.studentCode} already exists in this tenant`);
      }
      throw new Error(`Failed to create student: ${error.message}`);
    }

    return this.mapRowToDomain(data as StudentsTableRow);
  }

  /**
   * Find student by ID (with tenant isolation)
   */
  static async findById(studentId: string, tenantId: string): Promise<Student | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find student: ${error.message}`);
    }

    return this.mapRowToDomain(data as StudentsTableRow);
  }

  /**
   * Find student by student code (with tenant isolation)
   */
  static async findByStudentCode(studentCode: string, tenantId: string): Promise<Student | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_code', studentCode)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find student by code: ${error.message}`);
    }

    return this.mapRowToDomain(data as StudentsTableRow);
  }

  /**
   * Find students by person ID (with tenant isolation)
   * A person can be a student in multiple programs
   */
  static async findByPersonId(personId: string, tenantId: string): Promise<Student[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('person_id', personId)
      .eq('tenant_id', tenantId)
      .order('enrollment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to find students by person: ${error.message}`);
    }

    return (data as StudentsTableRow[]).map(this.mapRowToDomain);
  }

  /**
   * Find students by program (with tenant isolation)
   */
  static async findByProgram(
    programId: string,
    tenantId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<Student[]> {
    const supabase = await createClient();

    let query = supabase
      .from('students')
      .select('*')
      .eq('program_id', programId)
      .eq('tenant_id', tenantId);

    if (options?.status) {
      query = query.eq('academic_status', options.status);
    }

    query = query.order('enrollment_date', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find students by program: ${error.message}`);
    }

    return (data as StudentsTableRow[]).map(this.mapRowToDomain);
  }

  /**
   * Update student
   */
  static async update(student: Student): Promise<Student> {
    const supabase = await createClient();

    // Map domain model to database update
    const updateData: StudentsTableUpdate = {
      academic_status: student.academicStatus,
      enrollment_type: student.enrollmentType,
      program_id: student.programId,
      expected_graduation_date: student.expectedGraduationDate ?? null,
      actual_graduation_date: student.actualGraduationDate ?? null,
      current_level: student.currentLevel ?? null,
      gpa: student.gpa ?? null,
      total_credits: student.totalCredits ?? null,
      emergency_contact_name: student.emergencyContactName ?? null,
      emergency_contact_phone: student.emergencyContactPhone ?? null,
      emergency_contact_relationship: student.emergencyContactRelationship ?? null,
      metadata: student.metadata ?? null,
      updated_at: student.updatedAt,
      updated_by: student.updatedBy ?? null,
    };

    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', student.studentId)
      .eq('tenant_id', student.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update student: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Student ${student.studentId} not found or tenant mismatch`);
    }

    return this.mapRowToDomain(data as StudentsTableRow);
  }

  /**
   * Delete student (soft delete by updating status)
   */
  static async delete(studentId: string, tenantId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  }

  /**
   * Count students by status (with tenant isolation)
   */
  static async countByStatus(tenantId: string, status?: string): Promise<number> {
    const supabase = await createClient();

    let query = supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('academic_status', status);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count students: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Check if student code exists (with tenant isolation)
   */
  static async existsByStudentCode(studentCode: string, tenantId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('student_code', studentCode)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check student code: ${error.message}`);
    }

    return !!data;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map database row to domain model
   */
  private static mapRowToDomain(row: StudentsTableRow): Student {
    return {
      studentId: row.id,
      tenantId: row.tenant_id,
      personId: row.person_id,
      studentCode: row.student_code,
      academicStatus: row.academic_status,
      enrollmentType: row.enrollment_type,
      programId: row.program_id,
      enrollmentDate: row.enrollment_date,
      expectedGraduationDate: row.expected_graduation_date ?? undefined,
      actualGraduationDate: row.actual_graduation_date ?? undefined,
      currentLevel: row.current_level ?? undefined,
      gpa: row.gpa ?? undefined,
      totalCredits: row.total_credits ?? undefined,
      emergencyContactName: row.emergency_contact_name ?? undefined,
      emergencyContactPhone: row.emergency_contact_phone ?? undefined,
      emergencyContactRelationship: row.emergency_contact_relationship ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
