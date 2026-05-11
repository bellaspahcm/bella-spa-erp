'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getCustomers() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return data;
}

import { customerSchema } from '@/lib/validations';

export async function createCustomer(formData: any) {
  const supabase = (await createClient()) as any;
  
  // 0. Validate with Zod
  const validatedFields = customerSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    return { error: 'Dữ liệu không hợp lệ', details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  const { data, error } = await supabase
    .from('customers')
    .insert([
      {
        phone: validatedData.phone,
        name_mother: validatedData.name_mother,
        name_baby: validatedData.name_baby || null,
        address: validatedData.address,
        notes: validatedData.notes || null,
        dob_baby: validatedData.dob_baby || null,
        dob_expected: validatedData.dob_expected || null,
      } as any,
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/customers');
  return { data };
}
