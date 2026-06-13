'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type InvoicePrintLogInsert = Database['public']['Tables']['invoice_print_logs']['Insert'];

type RecordInvoicePrintLogParams = {
  bookingId: string;
  sessionLogId?: string | null;
  invoiceNumber: string;
  amountDue: number;
  transferMemo?: string | null;
  reason?: string | null;
};

const BOOKING_TENANT_ACCESS_ERROR = 'Khong xac dinh duoc don vi kinh doanh cua nguoi dung hien tai.';

function requireCurrentUserTenant(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser?.tenant_id) {
    throw new Error(BOOKING_TENANT_ACCESS_ERROR);
  }
  return currentUser.tenant_id;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function recordInvoicePrintLog(params: RecordInvoicePrintLogParams) {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = requireCurrentUserTenant(currentUser);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', params.bookingId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (bookingError) {
      return { success: false, error: bookingError.message };
    }

    if (!booking) {
      return { success: false, error: 'Không tìm thấy booking thuộc chi nhánh hiện tại.' };
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
