'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getBookings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }

  return data;
}

import { bookingSchema } from '@/lib/validations';

export async function createBooking(formData: any) {
  const supabase = await createClient();
  
  // 0. Validate with Zod
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    return { error: 'Dữ liệu không hợp lệ', details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  // 1. Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert([
      {
        customer_id: validatedData.customer_id,
        booking_number: `BK-${new Date().getTime()}`,
        package_id: validatedData.package_id || null,
        status: 'deposit_pending',
        full_price: validatedData.full_price,
        deposit_amount: validatedData.deposit_amount,
        total_sessions: validatedData.total_sessions,
        start_date: validatedData.start_date || null,
      },
    ])
    .select()
    .single();

  if (bookingError) {
    console.error('Error creating booking:', bookingError);
    return { error: bookingError.message };
  }

  // 2. Automation: Generate session logs (default 21 sessions)
  const totalSessions = booking.total_sessions || 21;
  const sessionLogs = Array.from({ length: totalSessions }, (_, i) => ({
    booking_id: booking.id,
    session_number: i + 1,
    status: 'scheduled',
  }));

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs);

  if (sessionsError) {
    console.error('Error creating session logs:', sessionsError);
    // Note: In production, you might want to rollback the booking creation here if this fails
    return { error: 'Booking created but session logs failed: ' + sessionsError.message };
  }

  revalidatePath('/dashboard/bookings');
  revalidatePath('/dashboard');
  return { data: booking };
}

export async function getSessionLogs(bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_logs')
    .select('*')
    .eq('booking_id', bookingId)
    .order('session_number', { ascending: true });

  if (error) {
    console.error('Error fetching session logs:', error);
    return [];
  }

  return data;
}
