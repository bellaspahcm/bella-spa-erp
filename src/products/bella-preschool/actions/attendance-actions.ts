/**
 * Bella Preschool — Attendance Actions
 *
 * Product-level server actions for attendance tracking
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, AttendanceDetail, PreschoolAttendance } from '../types';

/**
 * List attendance records with filters
 */
export async function listAttendanceAction(filters?: {
  date?: string;
  student_id?: string;
  classroom_id?: string;
}): Promise<ActionResult<AttendanceDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('preschool_attendance')
      .select(`
        *,
        student:preschool_students(
          id,
          student_code,
          first_name,
          last_name
        )
      `)
      .eq('tenant_id', user.tenant_id);

    if (filters?.date) {
      query = query.eq('attendance_date', filters.date);
    }

    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    if (filters?.classroom_id) {
      // Need to join through enrollments to filter by classroom
      const { data: enrollments } = await supabase
        .from('preschool_enrollments')
        .select('student_id')
        .eq('classroom_id', filters.classroom_id)
        .eq('status', 'active');
      
      const studentIds = enrollments?.map(e => e.student_id) || [];
      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      } else {
        // No enrollments, return empty
        return { success: true, data: [] };
      }
    }

    query = query.order('attendance_date', { ascending: false });
    query = query.order('check_in_time', { ascending: true });

    const { data: attendance, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (attendance || []) as AttendanceDetail[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check in student
 */
export async function checkInStudentAction(input: {
  student_id: string;
  check_in_time?: string;
  notes?: string;
}): Promise<ActionResult<PreschoolAttendance>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.student_id) {
      return { success: false, error: 'Student ID is required' };
    }

    const supabase = await createClient();

    // Verify student exists and is active
    const { data: student } = await supabase
      .from('preschool_students')
      .select('id, status')
      .eq('id', input.student_id)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    if (student.status !== 'active') {
      return { success: false, error: 'Cannot check in non-active student' };
    }

    const today = new Date().toISOString().split('T')[0];
    const checkInTime = input.check_in_time || new Date().toISOString();

    // Check if attendance record already exists for today
    const { data: existing } = await supabase
      .from('preschool_attendance')
      .select('id, status')
      .eq('student_id', input.student_id)
      .eq('attendance_date', today)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (existing) {
      if (existing.status === 'checked_in') {
        return { success: false, error: 'Student already checked in today' };
      }
      if (existing.status === 'checked_out') {
        return { success: false, error: 'Student already checked out today. Cannot check in again.' };
      }
    }

    // Create or update attendance record
    const attendanceData = {
      tenant_id: user.tenant_id,
      student_id: input.student_id,
      attendance_date: today,
      check_in_time: checkInTime,
      checked_in_by_user_id: user.id,
      status: 'checked_in' as const,
      notes: input.notes || null,
    };

    const { data: attendance, error } = await supabase
      .from('preschool_attendance')
      .upsert(attendanceData, {
        onConflict: 'tenant_id,student_id,attendance_date',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: attendance as PreschoolAttendance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check out student
 */
export async function checkOutStudentAction(input: {
  student_id: string;
  check_out_time?: string;
  picked_up_by_guardian_id?: string;
  notes?: string;
}): Promise<ActionResult<PreschoolAttendance>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.student_id) {
      return { success: false, error: 'Student ID is required' };
    }

    const supabase = await createClient();

    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance record
    const { data: attendance } = await supabase
      .from('preschool_attendance')
      .select('id, status, check_in_time, notes')
      .eq('student_id', input.student_id)
      .eq('attendance_date', today)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!attendance) {
      return { success: false, error: 'No check-in record found for today. Cannot check out.' };
    }

    if (attendance.status === 'checked_out') {
      return { success: false, error: 'Student already checked out today' };
    }

    if (attendance.status !== 'checked_in') {
      return { success: false, error: 'Student must be checked in before checking out' };
    }

    const checkOutTime = input.check_out_time || new Date().toISOString();

    // Verify guardian if provided
    if (input.picked_up_by_guardian_id) {
      const { data: guardian } = await supabase
        .from('preschool_student_guardians')
        .select('id, is_authorized_pickup')
        .eq('id', input.picked_up_by_guardian_id)
        .eq('student_id', input.student_id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (!guardian) {
        return { success: false, error: 'Guardian not found for this student' };
      }

      if (!guardian.is_authorized_pickup) {
        return { success: false, error: 'This guardian is not authorized for pickup' };
      }
    }

    // Update attendance record
    const { data: updated, error } = await supabase
      .from('preschool_attendance')
      .update({
        check_out_time: checkOutTime,
        checked_out_by_user_id: user.id,
        picked_up_by_guardian_id: input.picked_up_by_guardian_id || null,
        status: 'checked_out',
        notes: input.notes || attendance.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendance.id)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: updated as PreschoolAttendance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get attendance state for a student on a specific date
 */
export async function getAttendanceStateAction(input: {
  student_id: string;
  date?: string;
}): Promise<ActionResult<PreschoolAttendance | null>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.student_id) {
      return { success: false, error: 'Student ID is required' };
    }

    const supabase = await createClient();

    const targetDate = input.date || new Date().toISOString().split('T')[0];

    const { data: attendance, error } = await supabase
      .from('preschool_attendance')
      .select('*')
      .eq('student_id', input.student_id)
      .eq('attendance_date', targetDate)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: attendance as PreschoolAttendance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Mark student as absent
 */
export async function markAbsentAction(input: {
  student_id: string;
  absence_reason?: string;
}): Promise<ActionResult<PreschoolAttendance>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.student_id) {
      return { success: false, error: 'Student ID is required' };
    }

    const supabase = await createClient();

    const today = new Date().toISOString().split('T')[0];

    // Check if already has attendance record
    const { data: existing } = await supabase
      .from('preschool_attendance')
      .select('id, status')
      .eq('student_id', input.student_id)
      .eq('attendance_date', today)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (existing && existing.status !== 'absent') {
      return { success: false, error: 'Cannot mark as absent - student has check-in record today' };
    }

    const attendanceData = {
      tenant_id: user.tenant_id,
      student_id: input.student_id,
      attendance_date: today,
      status: 'absent' as const,
      absence_reason: input.absence_reason || null,
    };

    const { data: attendance, error } = await supabase
      .from('preschool_attendance')
      .upsert(attendanceData, {
        onConflict: 'tenant_id,student_id,attendance_date',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: attendance as PreschoolAttendance };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
