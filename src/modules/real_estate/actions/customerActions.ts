'use server';

import { createClient } from '@/utils/supabase/server';
import { getCurrentUser } from '@/services/user-actions';
import { revalidatePath } from 'next/cache';
import { Database } from '@/types/database.types';

type CustomerRow = Database['public']['Tables']['re_customers']['Row'];
type CustomerInsert = Database['public']['Tables']['re_customers']['Insert'];

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  email?: string | null;
}

export interface CustomerActionResult {
  success: boolean;
  data?: CustomerRow;
  error?: string;
}

/**
 * Create a new real estate customer
 */
export async function createCustomerAction(dto: CreateCustomerDTO): Promise<CustomerActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate required fields
    if (!dto.name || dto.name.trim() === '') {
      return { success: false, error: 'Customer name is required' };
    }

    if (!dto.phone || dto.phone.trim() === '') {
      return { success: false, error: 'Phone number is required' };
    }

    // Insert customer
    const customerData: CustomerInsert = {
      tenant_id: user.tenant_id,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      email: dto.email?.trim() || null,
      created_by: user.id,
      updated_by: user.id
    };

    const { data, error } = await supabase
      .from('re_customers')
      .insert(customerData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create customer:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505' && error.message.includes('unique_phone_per_tenant')) {
        return { 
          success: false, 
          error: 'Phone number already exists for this tenant' 
        };
      }

      return { success: false, error: error.message };
    }

    // Revalidate customers page
    revalidatePath('/dashboard/real-estate/customers');

    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error creating customer:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}

/**
 * Fetch all customers for current tenant
 */
export async function fetchCustomersAction(): Promise<CustomerActionResult & { data?: CustomerRow[] }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('re_customers')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch customers:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Unexpected error fetching customers:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}

/**
 * Update customer information
 */
export async function updateCustomerAction(
  customerId: string,
  updates: Partial<CreateCustomerDTO>
): Promise<CustomerActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const updateData: Partial<CustomerInsert> = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.phone !== undefined) {
      updateData.phone = updates.phone.trim();
    }
    if (updates.email !== undefined) {
      updateData.email = updates.email?.trim() || null;
    }

    const { data, error } = await supabase
      .from('re_customers')
      .update(updateData)
      .eq('id', customerId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update customer:', error);
      return { success: false, error: error.message };
    }

    // Revalidate customers page
    revalidatePath('/dashboard/real-estate/customers');

    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error updating customer:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}

/**
 * Delete customer (soft delete)
 */
export async function deleteCustomerAction(customerId: string): Promise<CustomerActionResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('re_customers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to delete customer:', error);
      return { success: false, error: error.message };
    }

    // Revalidate customers page
    revalidatePath('/dashboard/real-estate/customers');

    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error deleting customer:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unexpected error' 
    };
  }
}
