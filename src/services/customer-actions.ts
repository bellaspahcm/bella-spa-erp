'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getCustomers() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('customers')
    .select('*, bookings(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  // Flatten or map the data to match UI expectations if needed
  return data.map((c: any) => {
    const latestBooking = c.bookings && c.bookings.length > 0 ? c.bookings[0] : null;
    return {
      ...c,
      status: latestBooking ? (latestBooking.status === 'deposit_pending' ? 'deposit' : 'active') : 'lead',
      deposit_amount: latestBooking?.deposit_amount ? `${latestBooking.deposit_amount.toLocaleString()}đ` : null,
      package_name: latestBooking?.package_name || null, // Assuming package_name is in bookings or needs another join
      dob_expected: c.dob_expected || (latestBooking?.start_date)
    };
  });
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

  // 1. Create Customer
  const { data: customer, error: customerError } = await supabase
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

  if (customerError) {
    console.error('Error creating customer:', customerError);
    return { error: customerError.message };
  }

  // 2. If deposit or package provided, create a booking
  if (formData.deposit_amount || formData.package_name) {
    const deposit = parseInt(formData.deposit_amount?.replace(/,/g, '') || '0');
    
    await supabase.from('bookings').insert([{
      customer_id: customer.id,
      booking_number: `BK-${new Date().getTime()}`,
      status: deposit > 0 ? 'deposit_pending' : 'booked',
      deposit_amount: deposit,
      package_name: formData.package_name,
      total_sessions: 21, // Default
    } as any]);
  }

  revalidatePath('/dashboard/customers');
  return { data: customer };
}

export async function getCustomerById(id: string) {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('customers')
    .select('*, bookings(*, session_logs(*))')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching customer detail:', error);
    return null;
  }

  // Flatten or map the data to match UI expectations
  const latestBooking = data.bookings && data.bookings.length > 0 ? data.bookings[0] : null;
  return {
    ...data,
    status: latestBooking ? (latestBooking.status === 'deposit_pending' ? 'deposit' : 'active') : 'lead',
    deposit_amount: latestBooking?.deposit_amount ? `${latestBooking.deposit_amount.toLocaleString()}đ` : null,
    package_name: latestBooking?.package_name || 'Chưa đăng ký',
    dob_expected: data.dob_expected || (latestBooking?.start_date),
    sessions: latestBooking?.session_logs || []
  };
}
