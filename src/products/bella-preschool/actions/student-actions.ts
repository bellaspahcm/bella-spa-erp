/**
 * Bella Preschool — Student Actions
 *
 * Product-level server actions for student management
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, StudentDetail, PreschoolStudent } from '../types';

/**
 * List all preschool students for current tenant
 */
export async function listStudentsAction(): Promise<ActionResult<StudentDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: students, error } = await supabase
      .from('preschool_students')
      .select(`
        *,
        guardians:preschool_student_guardians(
          id,
          relationship_type,
          is_primary_contact,
          is_authorized_pickup,
          guardian:guardian_customer_id(
            id,
            name_mother,
            phone
          )
        ),
        current_enrollment:preschool_enrollments(
          id,
          classroom:preschool_classrooms(
            id,
            classroom_name,
            age_group
          )
        )
      `)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .order('last_name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    // Map to StudentDetail format with current classroom
    const studentsWithDetails: StudentDetail[] = (students || []).map((s: any) => {
      const activeEnrollment = (s.current_enrollment || []).find(
        (e: any) => e.classroom
      );
      
      return {
        ...s,
        current_classroom: activeEnrollment?.classroom || undefined,
        guardians: s.guardians || [],
      };
    });

    return { success: true, data: studentsWithDetails };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get student detail by ID
 */
export async function getStudentAction(
  studentId: string
): Promise<ActionResult<StudentDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: student, error } = await supabase
      .from('preschool_students')
      .select(`
        *,
        guardians:preschool_student_guardians(
          id,
          relationship_type,
          is_primary_contact,
          is_authorized_pickup,
          is_emergency_contact,
          guardian:guardian_customer_id(
            id,
            name_mother,
            phone,
            address
          )
        ),
        enrollments:preschool_enrollments(
          id,
          enrollment_date,
          status,
          classroom:preschool_classrooms(
            id,
            classroom_name,
            age_group
          )
        )
      `)
      .eq('id', studentId)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    // Find current active enrollment
    const activeEnrollment = (student.enrollments || []).find(
      (e: any) => e.status === 'active' && e.classroom
    );

    const studentDetail: StudentDetail = {
      ...student,
      current_classroom: activeEnrollment?.classroom || undefined,
      guardians: student.guardians || [],
    };

    return { success: true, data: studentDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create new preschool student
 */
export async function createStudentAction(input: {
  student_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: 'male' | 'female' | 'other';
  enrollment_date?: string;
  photo_url?: string;
  notes?: string;
  guardians?: Array<{
    guardian_customer_id: string;
    relationship_type: 'parent' | 'grandparent' | 'guardian' | 'other';
    is_primary_contact?: boolean;
    is_authorized_pickup?: boolean;
    is_emergency_contact?: boolean;
  }>;
}): Promise<ActionResult<PreschoolStudent>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.student_code || !input.first_name || !input.last_name || !input.date_of_birth) {
      return { success: false, error: 'Student code, first name, last name, and date of birth are required' };
    }

    const supabase = await createClient();

    // Create student
    const { data: student, error: studentError } = await supabase
      .from('preschool_students')
      .insert({
        tenant_id: user.tenant_id,
        student_code: input.student_code,
        first_name: input.first_name,
        last_name: input.last_name,
        date_of_birth: input.date_of_birth,
        gender: input.gender || null,
        enrollment_date: input.enrollment_date || new Date().toISOString().split('T')[0],
        status: 'active',
        photo_url: input.photo_url || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (studentError) {
      return { success: false, error: studentError.message };
    }

    // Add guardians if provided
    if (input.guardians && input.guardians.length > 0) {
      const guardianRecords = input.guardians.map((g) => ({
        tenant_id: user.tenant_id,
        student_id: student.id,
        guardian_customer_id: g.guardian_customer_id,
        relationship_type: g.relationship_type,
        is_primary_contact: g.is_primary_contact || false,
        is_authorized_pickup: g.is_authorized_pickup !== false,
        is_emergency_contact: g.is_emergency_contact || false,
      }));

      const { error: guardiansError } = await supabase
        .from('preschool_student_guardians')
        .insert(guardianRecords);

      if (guardiansError) {
        // Rollback student creation would require transaction
        // For now, return error but student exists
        return {
          success: false,
          error: `Student created but guardian link failed: ${guardiansError.message}`,
        };
      }
    }

    return { success: true, data: student };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update student information
 */
export async function updateStudentAction(
  studentId: string,
  input: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    status?: 'active' | 'withdrawn' | 'graduated';
    photo_url?: string;
    notes?: string;
  }
): Promise<ActionResult<PreschoolStudent>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Normalize empty strings to NULL for optional fields
    const updates: Record<string, any> = {
      first_name: input.first_name,
      last_name: input.last_name,
      date_of_birth: input.date_of_birth,
      gender: input.gender || null,
      notes: input.notes || null,
      photo_url: input.photo_url || null,
      updated_at: new Date().toISOString(),
    };

    const { data: student, error } = await supabase
      .from('preschool_students')
      .update(updates)
      .eq('id', studentId)
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: student };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
