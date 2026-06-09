'use server';

import { getLocalDateString } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { validateBookingPackageScope } from './create-booking-helpers';
import type { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];

export async function reusePackage(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !original) {
    return { error: 'Không tìm thấy gói cũ: ' + fetchError?.message };
  }

  const packageScopeResult = await validateBookingPackageScope(supabase, original.tenant_id, original.package_id);
  if ('error' in packageScopeResult) {
    return { error: packageScopeResult.error };
  }

  const bookingData: BookingInsert = {
    customer_id: original.customer_id,
    booking_number: `BK-${new Date().getTime()}`,
    package_id: original.package_id,
    status: 'deposit_pending',
    full_price: original.full_price,
    deposit_amount: 0,
    total_sessions: original.total_sessions,
    completed_sessions: 0,
    start_date: getLocalDateString(),
    tenant_id: original.tenant_id,
  };

  if (original.package_name) {
    bookingData.package_name = original.package_name;
  }

  const { data: newBookingData, error: createError } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select();

  const newBooking = newBookingData?.[0];

  if (createError) {
    if (createError.message?.includes('package_name')) {
      delete bookingData.package_name;
      const { data: retryBookingData, error: retryError } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select();
      
      if (retryError) return { error: 'Lỗi tạo gói mới: ' + retryError.message };
      return finalizeReuse(retryBookingData?.[0], original.total_sessions, supabase);
    }
    return { error: 'Lỗi tạo gói mới: ' + createError.message };
  }

  return finalizeReuse(newBooking, original.total_sessions, supabase);
}

async function finalizeReuse(newBooking: BookingRow | undefined, total: number | null, supabase: SupabaseServerClient) {
  if (!newBooking) {
    return { error: 'Không thể tạo gói mới: dữ liệu booking trả về rỗng.' };
  }

  const totalSessions = total || 21;
  let startDateStr = newBooking.start_date;
  if (!startDateStr) {
    const now = new Date();
    startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  const sessionLogs: SessionLogInsert[] = Array.from({ length: totalSessions }, (_, i) => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + i);
    const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
      booking_id: newBooking.id,
      session_number: i + 1,
      status: 'scheduled',
      assigned_date: assignedDate,
      tenant_id: newBooking.tenant_id,
    };
  });

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs);

  if (sessionsError) {
    await supabase
      .from('bookings')
      .delete()
      .eq('id', newBooking.id);
    return { error: 'Đã tạo gói mới nhưng lỗi khởi tạo lịch trình: ' + sessionsError.message };
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: newBooking.id,
      new_data: newBooking
    });
  } catch (auditErr) {
    await supabase
      .from('session_logs')
      .delete()
      .eq('booking_id', newBooking.id);
    await supabase
      .from('bookings')
      .delete()
      .eq('id', newBooking.id);
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : 'Failed to record reusePackage/finalizeReuse audit log'
    };
  }

  const revalPaths = [
    '/dashboard/sessions',
    '/dashboard/bookings',
    `/dashboard/customers/${newBooking.customer_id}`
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
  return { data: newBooking };
}
