import type { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingResourceRow = Pick<
  Database['public']['Tables']['booking_resources']['Row'],
  'id' | 'name' | 'resource_type' | 'status' | 'tenant_id'
>;

const RESOURCE_ACTIVE_SESSION_STATUSES = ['scheduled', 'in_progress'] as const;
const RESOURCE_AVAILABLE_STATUSES = ['available', 'in_use'] as const;

function getTimeConflictVariants(timeValue: string) {
  const match = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return [timeValue];

  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  const second = match[3] || '00';
  return Array.from(new Set([
    `${hour}:${minute}`,
    `${hour}:${minute}:${second}`,
    `${hour}:${minute}:00`,
  ]));
}

type ValidateBookingResourceScheduleParams = {
  supabase: SupabaseServerClient;
  tenantId: string;
  sessionId?: string | null;
  bookingResourceId?: string | null;
  assignedDate?: string | null;
  assignedTime?: string | null;
  status?: string | null;
};

export async function validateBookingResourceSchedule(params: ValidateBookingResourceScheduleParams) {
  const {
    supabase,
    tenantId,
    sessionId,
    bookingResourceId,
    assignedDate,
    assignedTime,
    status,
  } = params;

  if (!bookingResourceId || !assignedDate || !assignedTime) {
    return { success: true as const };
  }

  const nextStatus = status || 'scheduled';
  if (!RESOURCE_ACTIVE_SESSION_STATUSES.includes(nextStatus as (typeof RESOURCE_ACTIVE_SESSION_STATUSES)[number])) {
    return { success: true as const };
  }

  const { data: resource, error: resourceError } = await supabase
    .from('booking_resources')
    .select('id, name, resource_type, status, tenant_id')
    .eq('id', bookingResourceId)
    .eq('tenant_id', tenantId)
    .single();

  if (resourceError) {
    return { error: resourceError.message };
  }

  const bookingResource = resource as BookingResourceRow | null;
  if (!bookingResource) {
    return { error: 'Khong tim thay tai nguyen dat lich cua chi nhanh nay.' };
  }

  if (!RESOURCE_AVAILABLE_STATUSES.includes(bookingResource.status as (typeof RESOURCE_AVAILABLE_STATUSES)[number])) {
    return { error: `Tai nguyen ${bookingResource.name} hien khong kha dung de dat lich.` };
  }

  let conflictQuery = supabase
    .from('session_logs')
    .select('id, session_number')
    .eq('tenant_id', tenantId)
    .eq('booking_resource_id', bookingResource.id)
    .eq('assigned_date', assignedDate)
    .in('assigned_time', getTimeConflictVariants(assignedTime))
    .in('status', [...RESOURCE_ACTIVE_SESSION_STATUSES])
    .limit(1);

  if (sessionId) {
    conflictQuery = conflictQuery.neq('id', sessionId);
  }

  const { data: conflicts, error: conflictError } = await conflictQuery;
  if (conflictError) {
    return { error: conflictError.message };
  }

  if ((conflicts || []).length > 0) {
    return { error: `Tai nguyen ${bookingResource.name} da co lich trong khung gio nay.` };
  }

  return { success: true as const };
}
