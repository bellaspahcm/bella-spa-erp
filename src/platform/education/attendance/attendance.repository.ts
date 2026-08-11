/**
 * Attendance Repository
 * 
 * Pattern: Inherited from Course repository
 * Constitution Compliance: Law 2 (No direct DB access from Product Packs)
 */

import { createServerClient } from '@/lib/supabase-server';
import type { Attendance, AttendanceFilters } from '../shared-kernel/attendance-types';
import type { Database } from '@/types/supabase';

type AttendanceRow = Database['public']['Tables']['attendances']['Row'];
type AttendanceInsert = Database['public']['Tables']['attendances']['Insert'];
type AttendanceUpdate = Database['public']['Tables']['attendances']['Update'];

// ============================================================================
// Repository Interface
// ============================================================================

export interface IAttendanceRepository {
  create(attendance: Attendance): Promise<Attendance>;
  update(attendanceId: string, tenantId: string, updates: Partial<Attendance>): Promise<Attendance>;
  findById(attendanceId: string, tenantId: string): Promise<Attendance | null>;
  findByStudentAndCourseAndDate(
    studentId: string,
    courseId: string,
    sessionDate: string,
    tenantId: string
  ): Promise<Attendance | null>;
  findAll(filters: AttendanceFilters): Promise<Attendance[]>;
  delete(attendanceId: string, tenantId: string): Promise<void>;
}

// ============================================================================
// Supabase Repository Implementation
// ============================================================================

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  private supabase = createServerClient();

  async create(attendance: Attendance): Promise<Attendance> {
    const insertData: AttendanceInsert = {
      tenant_id: attendance.tenantId,
      student_id: attendance.studentId,
      course_id: attendance.courseId,
      enrollment_id: attendance.enrollmentId,
      session_date: attendance.sessionDate,
      session_number: attendance.sessionNumber,
      session_type: attendance.sessionType,
      session_duration: attendance.sessionDuration,
      status: attendance.status,
      check_in_time: attendance.checkInTime,
      check_out_time: attendance.checkOutTime,
      minutes_late: attendance.minutesLate,
      notes: attendance.notes,
      excuse_reason: attendance.excuseReason,
      excuse_document_url: attendance.excuseDocumentUrl,
      verified_by: attendance.verifiedBy,
      verified_at: attendance.verifiedAt,
      metadata: attendance.metadata,
      created_by: attendance.createdBy,
    };

    const { data, error } = await this.supabase
      .from('attendances')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create attendance: ${error.message}`);
    }

    return this.mapRowToAttendance(data);
  }

  async update(
    attendanceId: string,
    tenantId: string,
    updates: Partial<Attendance>
  ): Promise<Attendance> {
    const updateData: AttendanceUpdate = {
      status: updates.status,
      check_in_time: updates.checkInTime,
      check_out_time: updates.checkOutTime,
      minutes_late: updates.minutesLate,
      notes: updates.notes,
      excuse_reason: updates.excuseReason,
      excuse_document_url: updates.excuseDocumentUrl,
      verified_by: updates.verifiedBy,
      verified_at: updates.verifiedAt,
      metadata: updates.metadata,
      updated_by: updates.updatedBy,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof AttendanceUpdate] === undefined) {
        delete updateData[key as keyof AttendanceUpdate];
      }
    });

    const { data, error } = await this.supabase
      .from('attendances')
      .update(updateData)
      .eq('attendance_id', attendanceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update attendance: ${error.message}`);
    }

    if (!data) {
      throw new Error('Attendance not found');
    }

    return this.mapRowToAttendance(data);
  }

  async findById(attendanceId: string, tenantId: string): Promise<Attendance | null> {
    const { data, error } = await this.supabase
      .from('attendances')
      .select('*')
      .eq('attendance_id', attendanceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find attendance: ${error.message}`);
    }

    return this.mapRowToAttendance(data);
  }

  async findByStudentAndCourseAndDate(
    studentId: string,
    courseId: string,
    sessionDate: string,
    tenantId: string
  ): Promise<Attendance | null> {
    const { data, error } = await this.supabase
      .from('attendances')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('session_date', sessionDate)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find attendance: ${error.message}`);
    }

    return this.mapRowToAttendance(data);
  }

  async findAll(filters: AttendanceFilters): Promise<Attendance[]> {
    let query = this.supabase
      .from('attendances')
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.courseId) {
      query = query.eq('course_id', filters.courseId);
    }

    if (filters.enrollmentId) {
      query = query.eq('enrollment_id', filters.enrollmentId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.sessionDateFrom) {
      query = query.gte('session_date', filters.sessionDateFrom);
    }

    if (filters.sessionDateTo) {
      query = query.lte('session_date', filters.sessionDateTo);
    }

    if (filters.sessionType) {
      query = query.eq('session_type', filters.sessionType);
    }

    query = query.order('session_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query attendances: ${error.message}`);
    }

    return data.map(row => this.mapRowToAttendance(row));
  }

  async delete(attendanceId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('attendances')
      .delete()
      .eq('attendance_id', attendanceId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete attendance: ${error.message}`);
    }
  }

  // ============================================================================
  // Mapping Functions
  // ============================================================================

  private mapRowToAttendance(row: AttendanceRow): Attendance {
    return {
      attendanceId: row.attendance_id,
      tenantId: row.tenant_id,
      studentId: row.student_id,
      courseId: row.course_id,
      enrollmentId: row.enrollment_id ?? undefined,
      sessionDate: row.session_date,
      sessionNumber: row.session_number ?? undefined,
      sessionType: row.session_type as Attendance['sessionType'],
      sessionDuration: row.session_duration ?? undefined,
      status: row.status as Attendance['status'],
      checkInTime: row.check_in_time ?? undefined,
      checkOutTime: row.check_out_time ?? undefined,
      minutesLate: row.minutes_late ?? undefined,
      notes: row.notes ?? undefined,
      excuseReason: row.excuse_reason ?? undefined,
      excuseDocumentUrl: row.excuse_document_url ?? undefined,
      verifiedBy: row.verified_by ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by ?? undefined,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAttendanceRepository(): IAttendanceRepository {
  return new SupabaseAttendanceRepository();
}
