'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { BookingError } from '@/core/lib/errors';
import type { Database } from '@/types/database.types';

type InvoicePrintLogInsert = Database['public']['Tables']['invoice_print_logs']['Insert'];
type InvoicePrintLogUpdate = Database['public']['Tables']['invoice_print_logs']['Update'];

type RecordInvoicePrintLogParams = {
  bookingId: string;
  sessionLogId?: string | null;
  invoiceNumber: string;
  amountDue: number;
  transferMemo?: string | null;
  reason?: string | null;
};

type VoidLatestInvoicePrintLogParams = {
  bookingId: string;
  reason: string;
};

export type BookingInvoicePrintLog = Database['public']['Tables']['invoice_print_logs']['Row'] & {
  printed_by_user?: {
    full_name: string | null;
    role: string | null;
  } | null;
  voided_by_user?: {
    full_name: string | null;
    role: string | null;
  } | null;
};

const BOOKING_TENANT_ACCESS_ERROR = 'Khong xac dinh duoc don vi kinh doanh cua nguoi dung hien tai.';

function requireCurrentUserTenant(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser?.tenant_id) {
    throw new BookingError(BOOKING_TENANT_ACCESS_ERROR, 'BOOKING_TENANT_ACCESS_ERROR');
  }
  return currentUser.tenant_id;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function canManageInvoicePrintLog(role: string | null | undefined) {
  return role === 'admin' || role === 'admin_staff' || role === 'accountant';
}

async function assertBookingBelongsToTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  tenantId: string,
) {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (bookingError) {
    return { success: false as const, error: bookingError.message };
  }

  if (!booking) {
    return { success: false as const, error: 'Không tìm thấy booking thuộc chi nhánh hiện tại.' };
  }

  return { success: true as const };
}

export async function getInvoicePrintLogsForBooking(bookingId: string) {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireCurrentUserTenant(currentUser);
    const bookingGuard = await assertBookingBelongsToTenant(supabase, bookingId, tenantId);

    if (!bookingGuard.success) {
      return { success: false, error: bookingGuard.error, data: [] as BookingInvoicePrintLog[] };
    }

    const { data, error } = await supabase
      .from('invoice_print_logs')
      .select(`
        *,
        printed_by_user:users!invoice_print_logs_printed_by_fkey(full_name, role),
        voided_by_user:users!invoice_print_logs_voided_by_fkey(full_name, role)
      `)
      .eq('tenant_id', tenantId)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message, data: [] as BookingInvoicePrintLog[] };
    }

    return { success: true, data: (data || []) as BookingInvoicePrintLog[] };
  } catch (error) {
    return { success: false, error: getErrorMessage(error), data: [] as BookingInvoicePrintLog[] };
  }
}

export async function recordInvoicePrintLog(params: RecordInvoicePrintLogParams) {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireCurrentUserTenant(currentUser);

    const bookingGuard = await assertBookingBelongsToTenant(supabase, params.bookingId, tenantId);
    if (!bookingGuard.success) {
      return { success: false, error: bookingGuard.error };
    }

    const { count, error: countError } = await supabase
      .from('invoice_print_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('invoice_number', params.invoiceNumber);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const printCount = (count || 0) + 1;
    if (printCount > 1 && !canManageInvoicePrintLog(currentUser?.role)) {
      return { success: false, error: 'Bạn không có quyền in lại bill.' };
    }

    const payload: InvoicePrintLogInsert = {
      tenant_id: tenantId,
      booking_id: params.bookingId,
      session_log_id: params.sessionLogId || null,
      invoice_number: params.invoiceNumber,
      printed_by: currentUser?.id || null,
      print_count: printCount,
      print_type: printCount > 1 ? 'reprint' : 'original',
      reason: params.reason || null,
      amount_due: Number.isFinite(params.amountDue) ? params.amountDue : 0,
      transfer_memo: params.transferMemo || null,
    };

    const { data, error } = await supabase
      .from('invoice_print_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function voidLatestInvoicePrintLog(params: VoidLatestInvoicePrintLogParams) {
  try {
    const reason = params.reason.trim();
    if (reason.length < 5) {
      return { success: false, error: 'Vui lòng nhập lý do hủy bill rõ ràng hơn.' };
    }

    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireCurrentUserTenant(currentUser);

    if (!canManageInvoicePrintLog(currentUser?.role)) {
      return { success: false, error: 'Bạn không có quyền hủy bill đã in.' };
    }

    const bookingGuard = await assertBookingBelongsToTenant(supabase, params.bookingId, tenantId);
    if (!bookingGuard.success) {
      return { success: false, error: bookingGuard.error };
    }

    const { data: latestLog, error: latestLogError } = await supabase
      .from('invoice_print_logs')
      .select('id, invoice_number, print_count')
      .eq('tenant_id', tenantId)
      .eq('booking_id', params.bookingId)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLogError) {
      return { success: false, error: latestLogError.message };
    }

    if (!latestLog) {
      return { success: false, error: 'Không có bill đang hiệu lực để hủy.' };
    }

    const payload: InvoicePrintLogUpdate = {
      voided_at: new Date().toISOString(),
      voided_by: currentUser?.id || null,
      void_reason: reason,
    };

    const { data, error } = await supabase
      .from('invoice_print_logs')
      .update(payload)
      .eq('id', latestLog.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
