/**
 * Bella Preschool — Classroom Actions
 *
 * Product-level server actions for classroom management
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, ClassroomDetail, PreschoolClassroom } from '../types';

/**
 * List all classrooms for current tenant
 */
export async function listClassroomsAction(): Promise<ActionResult<ClassroomDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: classrooms, error } = await supabase
      .from('preschool_classrooms')
      .select(`
        *,
        enrollments:preschool_enrollments(count)
      `)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .order('classroom_name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const classroomsWithCounts: ClassroomDetail[] = (classrooms || []).map((c: any) => ({
      ...c,
      enrollment_count: c.enrollments?.[0]?.count || 0,
    }));

    return { success: true, data: classroomsWithCounts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get classroom detail with enrolled students
 */
export async function getClassroomAction(
  classroomId: string
): Promise<ActionResult<ClassroomDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: classroom, error } = await supabase
      .from('preschool_classrooms')
      .select(`
        *,
        lead_teacher:lead_teacher_id(id, full_name),
        assistant_teacher:assistant_teacher_id(id, full_name),
        enrollments:preschool_enrollments(
          id,
          status,
          student:preschool_students(
            id,
            student_code,
            first_name,
            last_name,
            date_of_birth,
            status
          )
        )
      `)
      .eq('id', classroomId)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error) {
      // Normalize error messages for better UX
      if (error.message.includes('coerce') || error.code === 'PGRST116') {
        return { success: false, error: 'Classroom not found' };
      }
      return { success: false, error: error.message };
    }

    if (!classroom) {
      return { success: false, error: 'Classroom not found' };
    }

    // Extract active enrolled students
    const enrolledStudents = (classroom.enrollments || [])
      .filter((e: any) => e.status === 'active' && e.student)
      .map((e: any) => e.student);

    const classroomDetail: ClassroomDetail = {
      ...classroom,
      enrolled_students: enrolledStudents,
      enrollment_count: enrolledStudents.length,
    } as unknown as ClassroomDetail;

    return { success: true, data: classroomDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create new classroom
 */
export async function createClassroomAction(input: {
  classroom_name: string;
  classroom_code?: string;
  age_group?: string;
  capacity?: number;
  lead_teacher_id?: string;
  assistant_teacher_id?: string;
  room_location?: string;
  notes?: string;
}): Promise<ActionResult<PreschoolClassroom>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.classroom_name) {
      return { success: false, error: 'Classroom name is required' };
    }

    const supabase = await createClient();

    const { data: classroom, error } = await supabase
      .from('preschool_classrooms')
      .insert({
        tenant_id: user.tenant_id,
        classroom_name: input.classroom_name,
        classroom_code: input.classroom_code || null,
        age_group: input.age_group || null,
        capacity: input.capacity || null,
        lead_teacher_id: input.lead_teacher_id || null,
        assistant_teacher_id: input.assistant_teacher_id || null,
        is_active: true,
        room_location: input.room_location || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: classroom };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enroll student in classroom
 */
export async function enrollStudentAction(input: {
  student_id: string;
  classroom_id: string;
  enrollment_date?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!input.student_id || !input.classroom_id) {
      return { success: false, error: 'Student ID and Classroom ID are required' };
    }

    const supabase = await createClient();

    // Verify student exists and belongs to tenant
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
      return { success: false, error: 'Cannot enroll non-active student' };
    }

    // Verify classroom exists
    const { data: classroom } = await supabase
      .from('preschool_classrooms')
      .select('id, is_active')
      .eq('id', input.classroom_id)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (!classroom) {
      return { success: false, error: 'Classroom not found' };
    }

    if (!classroom.is_active) {
      return { success: false, error: 'Cannot enroll in inactive classroom' };
    }

    // Check if student already has active enrollment
    const { data: existingEnrollment } = await supabase
      .from('preschool_enrollments')
      .select('id, classroom_id')
      .eq('student_id', input.student_id)
      .eq('status', 'active')
      .single();

    if (existingEnrollment) {
      if (existingEnrollment.classroom_id === input.classroom_id) {
        return { success: false, error: 'Student already enrolled in this classroom' };
      }
      return {
        success: false,
        error: 'Student already has an active enrollment. Complete or transfer existing enrollment first.',
      };
    }

    // Create enrollment
    const { data: enrollment, error } = await supabase
      .from('preschool_enrollments')
      .insert({
        tenant_id: user.tenant_id,
        student_id: input.student_id,
        classroom_id: input.classroom_id,
        enrollment_date: input.enrollment_date || new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: enrollment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update classroom
 */
export async function updateClassroomAction(
  classroomId: string,
  input: {
    classroom_name?: string;
    classroom_code?: string;
    age_group?: string;
    capacity?: number;
    lead_teacher_id?: string;
    assistant_teacher_id?: string;
    room_location?: string;
    notes?: string;
    is_active?: boolean;
  }
): Promise<ActionResult<PreschoolClassroom>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify classroom exists and belongs to tenant
    const { data: existing } = await supabase
      .from('preschool_classrooms')
      .select('id')
      .eq('id', classroomId)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      return { success: false, error: 'Classroom not found' };
    }

    // Normalize empty strings to null
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.classroom_name !== undefined) updateData.classroom_name = input.classroom_name;
    if (input.classroom_code !== undefined)
      updateData.classroom_code = input.classroom_code || null;
    if (input.age_group !== undefined) updateData.age_group = input.age_group || null;
    if (input.capacity !== undefined) updateData.capacity = input.capacity || null;
    if (input.lead_teacher_id !== undefined)
      updateData.lead_teacher_id = input.lead_teacher_id || null;
    if (input.assistant_teacher_id !== undefined)
      updateData.assistant_teacher_id = input.assistant_teacher_id || null;
    if (input.room_location !== undefined)
      updateData.room_location = input.room_location || null;
    if (input.notes !== undefined) updateData.notes = input.notes || null;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { data: classroom, error } = await supabase
      .from('preschool_classrooms')
      .update(updateData)
      .eq('id', classroomId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: classroom };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
