'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { resolvePackageName } from '@/lib/utils';

export async function getPackages() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active packages: ${error.message}`);
  }
  return data || [];
}

export async function getBookings() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone), packages!bookings_package_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }
  
  if (!data || data.length === 0) return [];
  
  return (data || []).map((b: any) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    end_date: b.end_date,
    expected_birth_date: b.expected_birth_date
  }));
}

export async function getBookingsByCustomerId(customerId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *, 
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name, phone), 
      packages!bookings_package_id_fkey(name),
      session_logs(
        *,
        completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey(full_name, phone)
      ),
      revenue(
        *,
        recorded_by:users!revenue_recorded_by_id_fkey(full_name)
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bookings for customer ${customerId}: ${error.message}`);
  }
  
  if (!data || data.length === 0) return [];
  
  return (data || []).map((b: any) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    expected_birth_date: b.expected_birth_date
  }));
}

export async function getDraftBooking(customerId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone, address)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch draft booking for customer ${customerId}: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  
  const b = data[0];
  if (b.status === 'deposit_pending' || b.status === 'lead') {
    return b;
  }
  
  return null;
}