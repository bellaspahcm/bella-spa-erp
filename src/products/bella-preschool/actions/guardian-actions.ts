/**
 * Bella Preschool — Guardian Actions
 *
 * Guardian management actions for student-guardian relationships
 * 
 * OWNERSHIP:
 * - Guardian entity = customers table (Platform canonical)
 * - preschool_student_guardians = relationship metadata only
 * - Update contact info → update customers table
 * - Update relationship → update preschool_student_guardians
 * - Remove guardian = unlink relationship (do NOT delete customer)
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult } from '../types';

/**
 * Search customers to find potential guardians
 */
export async function searchCustomersAction(
  query: string
): Promise<ActionResult<Array<{
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}>>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const supabase = await createClient();

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name_mother, phone, address')
      .eq('tenant_id', user.tenant_id)
      .or(`name_mother.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);

    if (error) {
      return { success: false, error: error.message };
    }

    const results = (customers || []).map((c: any) => ({
      id: c.id,
      name: c.name_mother || 'Unnamed',
      phone: c.phone,
      email: c.address, // Using address field for email (schema limitation)
    }));

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Link existing customer as guardian to student
 */
export async function addGuardianAction(input: {
  student_id: string;
  guardian_customer_id: string;
  relationship_type: 'parent' | 'grandparent' | 'guardian' | 'other';
  is_primary: boolean;
  is_emergency_contact: boolean;
  pickup_authorized: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.student_id || !input.guardian_customer_id) {
      return { success: false, error: 'Student ID and Guardian ID are required' };
    }

    const supabase = await createClient();

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('preschool_student_guardians')
      .select('id')
      .eq('student_id', input.student_id)
      .eq('guardian_customer_id', input.guardian_customer_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (existing) {
      return { success: false, error: 'This guardian is already linked to the student' };
    }

    // If setting as primary, unset other primary guardians for this student
    if (input.is_primary) {
      await supabase
        .from('preschool_student_guardians')
        .update({ is_primary_contact: false })
        .eq('student_id', input.student_id)
        .eq('tenant_id', user.tenant_id);
    }

    // Create relationship
    const { data: guardian, error } = await supabase
      .from('preschool_student_guardians')
      .insert({
        tenant_id: user.tenant_id,
        student_id: input.student_id,
        guardian_customer_id: input.guardian_customer_id,
        relationship_type: input.relationship_type,
        is_primary_contact: input.is_primary,
        is_emergency_contact: input.is_emergency_contact,
        is_authorized_pickup: input.pickup_authorized,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { id: guardian.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update guardian relationship metadata
 * (Does NOT update customer contact info - use customers update for that)
 */
export async function updateGuardianRelationshipAction(
  guardianId: string,
  input: {
    relationship_type?: 'parent' | 'grandparent' | 'guardian' | 'other';
    is_primary?: boolean;
    is_emergency_contact?: boolean;
    pickup_authorized?: boolean;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!guardianId) {
      return { success: false, error: 'Guardian ID is required' };
    }

    const supabase = await createClient();

    // Get current guardian to check student_id
    const { data: current, error: fetchError } = await supabase
      .from('preschool_student_guardians')
      .select('student_id')
      .eq('id', guardianId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Guardian relationship not found' };
    }

    // If setting as primary, unset other primary guardians for this student
    if (input.is_primary === true) {
      await supabase
        .from('preschool_student_guardians')
        .update({ is_primary_contact: false })
        .eq('student_id', current.student_id)
        .eq('tenant_id', user.tenant_id)
        .neq('id', guardianId);
    }

    // Update relationship
    const updates: any = {};
    if (input.relationship_type !== undefined) {
      updates.relationship_type = input.relationship_type;
    }
    if (input.is_primary !== undefined) {
      updates.is_primary_contact = input.is_primary;
    }
    if (input.is_emergency_contact !== undefined) {
      updates.is_emergency_contact = input.is_emergency_contact;
    }
    if (input.pickup_authorized !== undefined) {
      updates.is_authorized_pickup = input.pickup_authorized;
    }

    const { error } = await supabase
      .from('preschool_student_guardians')
      .update(updates)
      .eq('id', guardianId)
      .eq('tenant_id', user.tenant_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { id: guardianId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unlink guardian from student
 * (Removes relationship, does NOT delete customer)
 */
export async function removeGuardianAction(
  guardianId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    if (!guardianId) {
      return { success: false, error: 'Guardian ID is required' };
    }

    const supabase = await createClient();

    // Delete relationship (does NOT delete customer)
    const { error } = await supabase
      .from('preschool_student_guardians')
      .delete()
      .eq('id', guardianId)
      .eq('tenant_id', user.tenant_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { id: guardianId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get guardian details with customer info
 */
export async function getGuardianAction(
  guardianId: string
): Promise<ActionResult<{
  id: string;
  student_id: string;
  relationship_type: string;
  is_primary_contact: boolean;
  is_emergency_contact: boolean;
  is_authorized_pickup: boolean;
  guardian: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
}>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: guardian, error } = await supabase
      .from('preschool_student_guardians')
      .select(`
        id,
        student_id,
        relationship_type,
        is_primary_contact,
        is_emergency_contact,
        is_authorized_pickup,
        guardian:guardian_customer_id(
          id,
          name_mother,
          phone,
          address
        )
      `)
      .eq('id', guardianId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (error || !guardian) {
      return { success: false, error: 'Guardian not found' };
    }

    const guardianData = guardian.guardian as any;

    return {
      success: true,
      data: {
        id: guardian.id,
        student_id: guardian.student_id,
        relationship_type: guardian.relationship_type,
        is_primary_contact: guardian.is_primary_contact,
        is_emergency_contact: guardian.is_emergency_contact,
        is_authorized_pickup: guardian.is_authorized_pickup,
        guardian: {
          id: guardianData.id,
          name: guardianData.name_mother || 'Unnamed',
          phone: guardianData.phone,
          email: guardianData.address,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
