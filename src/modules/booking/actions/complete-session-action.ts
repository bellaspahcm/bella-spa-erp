'use server';

import { getLocalDateString } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';
import { processSessionCompletion } from './session-completion-engine';

export async function completeSession(sessionId: string, bookingId: string, customNote?: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  // 0. Security Check
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (existingLog?.status === 'completed') {
    return { error: 'Buổi dịch vụ này đã hoàn thành trước đó (Idempotent)' };
  }

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status ?? '')) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

  // 1. Get current booking to check assigned KTV and package
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('assigned_ktv_id, package_id, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !bookingData) {
    return { error: 'Không tìm thấy thông tin booking liên quan.' };
  }

  if (bookingData.status === 'cancelled') {
    return { error: 'Không thể hoàn thành buổi dịch vụ cho booking đã hủy.' };
  }

  if (!bookingData.assigned_ktv_id) {
    return { error: 'Chưa phân công KTV chính. Vui lòng phân công KTV trước khi xác nhận hoàn thành buổi.' };
  }

  const updatePayload: Database['public']['Tables']['session_logs']['Update'] = {
    status: 'completed',
    completed_date: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()),
    completed_by_ktv_id: bookingData.assigned_ktv_id
  };

  if (customNote !== undefined) {
    updatePayload.notes = customNote;
  }

  // 2. Update session log status with KTV snapshot
  const { error: sessionError } = await supabase
    .from('session_logs')
    .update(updatePayload)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  // 3. Gọi helper dùng chung để chốt ca làm việc, trừ kho, tính lương KTV
  const today = getLocalDateString();
  const tenantId = currentUser?.tenant_id || existingLog?.tenant_id;
  const ktvId = bookingData.assigned_ktv_id;

  const result = await processSessionCompletion(
    supabase,
    sessionId,
    bookingId,
    tenantId,
    ktvId,
    today,
    bookingData.package_id,
    existingLog,
    currentUser
  );

  if (result.error) {
    console.error('[completeSession] Failed to process session completion, rolling back status:', result.error);
    // Rollback session status
    await supabase.from('session_logs').update({
      status: existingLog?.status || 'scheduled',
      completed_date: null,
      completed_by_ktv_id: null
    }).eq('id', sessionId);
    
    return { error: result.error };
  }

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { success: true };
}