/**
 * Bella Preschool — Enrollment Actions
 *
 * Product-level server actions for enrollment management
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, PreschoolEnrollment } from '../types';

/**
 * List enrollments with student and classroom details
 */
export async function listEnrollmentsAction(filters?: {
  student_id?: string;
  classroom_id?: string;
  status?: 'active' | 'transferred' | 'completed' | 'withdrawn';
}): Promise<
  ActionResult<
    Array<
      PreschoolEnrollment & {
        student?: any;
        classroom?: any;
      }
    >
  >
> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('preschool_enrollments')
      .select(
        `
        *,
        student:preschool_students(
          id,
          student_code,
          first_name,
          last_name,
          date_of_birth,
          status
        ),
        classroom:preschool_classrooms(
          id,
          classroom_name,
          classroom_code,
          age_group
        )
      `
      )
      .eq('tenant_id', user.tenant_id)
      .order('enrollment_date', { ascending: false });

    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    if (filters?.classroom_id) {
      query = query.eq('classroom_id', filters.classroom_id);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data: enrollments, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (enrollments || []) as any };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get enrollment detail
 */
export async function getEnrollmentAction(
  enrollmentId: string
): Promise<
  ActionResult<
    PreschoolEnrollment & {
      student?: any;
      classroom?: any;
    }
  >
> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: enrollment, error } = await supabase
      .from('preschool_enrollments')
      .select(
        `
        *,
        student:preschool_students(
          id,
          student_code,
          first_name,
          last_name,
          date_of_birth,
          status,
          photo_url
        ),
        classroom:preschool_classrooms(
          id,
          classroom_name,
          classroom_code,
          age_group,
          capacity,
          room_location
        )
      `
      )
      .eq('id', enrollmentId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (error) {
      if (error.message.includes('coerce') || error.code === 'PGRST116') {
        return { success: false, error: 'Enrollment not found' };
      }
      return { success: false, error: error.message };
    }

    if (!enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    return { success: true, data: enrollment as any };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update enrollment status
 */
export async function updateEnrollmentStatusAction(
  enrollmentId: string,
  status: 'active' | 'transferred' | 'completed' | 'withdrawn',
  end_date?: string
): Promise<ActionResult<PreschoolEnrollment>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify enrollment exists and belongs to tenant
    const { data: existing } = await supabase
      .from('preschool_enrollments')
      .select('id, status')
      .eq('id', enrollmentId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Enrollment not found' };
    }

    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set end_date for non-active statuses
    if (status !== 'active') {
      updateData.end_date = end_date || new Date().toISOString().split('T')[0];
    }

    const { data: enrollment, error } = await supabase
      .from('preschool_enrollments')
      .update(updateData)
      .eq('id', enrollmentId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: enrollment as any };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Transfer student to new classroom
 */
export async function transferEnrollmentAction(
  currentEnrollmentId: string,
  newClassroomId: string,
  transferDate?: string
): Promise<ActionResult<{ old_enrollment_id: string; new_enrollment_id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify current enrollment
    const { data: currentEnrollment } = await supabase
      .from('preschool_enrollments')
      .select('id, student_id, classroom_id, status')
      .eq('id', currentEnrollmentId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!currentEnrollment) {
      return { success: false, error: 'Current enrollment not found' };
    }

    if (currentEnrollment.status !== 'active') {
      return { success: false, error: 'Can only transfer active enrollments' };
    }

    // Verify new classroom exists
    const { data: newClassroom } = await supabase
      .from('preschool_classrooms')
      .select('id, is_active')
      .eq('id', newClassroomId)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (!newClassroom) {
      return { success: false, error: 'New classroom not found' };
    }

    if (!newClassroom.is_active) {
      return { success: false, error: 'Cannot transfer to inactive classroom' };
    }

    if (currentEnrollment.classroom_id === newClassroomId) {
      return { success: false, error: 'Student is already in this classroom' };
    }

    const transferDateValue = transferDate || new Date().toISOString().split('T')[0];

    // Complete old enrollment
    const { error: completeError } = await supabase
      .from('preschool_enrollments')
      .update({
        status: 'transferred',
        end_date: transferDateValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentEnrollmentId)
      .eq('tenant_id', user.tenant_id);

    if (completeError) {
      return { success: false, error: completeError.message };
    }

    // Create new enrollment
    const { data: newEnrollment, error: createError } = await supabase
      .from('preschool_enrollments')
      .insert({
        tenant_id: user.tenant_id,
        student_id: currentEnrollment.student_id,
        classroom_id: newClassroomId,
        enrollment_date: transferDateValue,
        status: 'active',
      })
      .select('id')
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    return {
      success: true,
      data: {
        old_enrollment_id: currentEnrollmentId,
        new_enrollment_id: newEnrollment.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
