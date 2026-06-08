'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import {
  buildBookingResourcePayload,
  type BookingResourceInput,
} from '@/lib/business-rules/booking-resource';
import { getAuthorizedTenantUser } from './auth-guards';
import { recordAuditLog } from './audit-actions';
import type { Database, Json } from '@/types/database.types';

type BookingResourceRow = Database['public']['Tables']['booking_resources']['Row'];
type BookingResourceInsert = Database['public']['Tables']['booking_resources']['Insert'];
type BookingResourceUpdate = Database['public']['Tables']['booking_resources']['Update'];
type BookingResourceActionResult =
  | { success: true; data: BookingResourceRow }
  | { success: false; error: string };
type BookingResourceListResult =
  | { success: true; data: BookingResourceRow[] }
  | { success: false; error: string };
type BookingResourceDeleteResult =
  | { success: true }
  | { success: false; error: string };

const RESOURCE_READ_ROLES = ['admin', 'super_admin', 'admin_staff', 'hr', 'accountant'] as const;
const RESOURCE_MANAGE_ROLES = ['admin', 'super_admin', 'admin_staff'] as const;
const RESOURCE_AUTH_ERROR = 'Không có quyền quản lý tài nguyên đặt lịch.';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

function toAuditJson(value: BookingResourceRow | BookingResourceInsert | BookingResourceUpdate): Json {
  return value as Json;
}

async function rollbackCreateResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
) {
  const { error } = await supabase
    .from('booking_resources')
    .delete()
    .eq('id', resourceId);

  return error?.message || null;
}

async function rollbackUpdateResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
  oldResource: BookingResourceRow,
) {
  const restorePayload: BookingResourceUpdate = oldResource;
  const { error } = await supabase
    .from('booking_resources')
    .update(restorePayload)
    .eq('id', resourceId);

  return error?.message || null;
}

async function rollbackDeleteResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oldResource: BookingResourceRow,
) {
  const restorePayload: BookingResourceInsert = oldResource;
  const { error } = await supabase
    .from('booking_resources')
    .insert([restorePayload]);

  return error?.message || null;
}

function withRollbackError(error: unknown, fallback: string, rollbackError: string | null) {
  const actionError = getErrorMessage(error, fallback);
  return rollbackError ? `${actionError}; Rollback failed: ${rollbackError}` : actionError;
}

export async function getBookingResources(): Promise<BookingResourceListResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: RESOURCE_READ_ROLES,
    errorMessage: RESOURCE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('booking_resources')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('resource_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

export async function createBookingResource(
  input: BookingResourceInput,
): Promise<BookingResourceActionResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: RESOURCE_MANAGE_ROLES,
    errorMessage: RESOURCE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const ruleResult = buildBookingResourcePayload(input, { tenantId: auth.tenantId });
  if (!ruleResult.success) {
    return { success: false, error: ruleResult.error };
  }

  const supabase = await createClient();
  const dbPayload: BookingResourceInsert = ruleResult.payload;
  const { data, error } = await supabase
    .from('booking_resources')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: 'Không xác định được tài nguyên đặt lịch vừa tạo.' };
  }

  try {
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'booking_resources',
      record_id: data.id,
      new_data: toAuditJson(data),
    });
  } catch (auditError) {
    const rollbackError = await rollbackCreateResource(supabase, data.id);
    return {
      success: false,
      error: withRollbackError(auditError, 'Failed to record createBookingResource audit log', rollbackError),
    };
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true, data };
}

export async function updateBookingResource(
  resourceId: string,
  input: BookingResourceInput,
): Promise<BookingResourceActionResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: RESOURCE_MANAGE_ROLES,
    errorMessage: RESOURCE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const supabase = await createClient();
  const { data: oldResource, error: existingError } = await supabase
    .from('booking_resources')
    .select('*')
    .eq('id', resourceId)
    .eq('tenant_id', auth.tenantId)
    .single();

  if (existingError) {
    return { success: false, error: existingError.message };
  }
  if (!oldResource) {
    return { success: false, error: 'Không tìm thấy tài nguyên đặt lịch.' };
  }

  const ruleResult = buildBookingResourcePayload(input, { tenantId: auth.tenantId });
  if (!ruleResult.success) {
    return { success: false, error: ruleResult.error };
  }

  const dbPayload: BookingResourceUpdate = {
    ...ruleResult.payload,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('booking_resources')
    .update(dbPayload)
    .eq('id', resourceId)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: 'Không xác định được tài nguyên đặt lịch vừa cập nhật.' };
  }

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'booking_resources',
      record_id: resourceId,
      old_data: toAuditJson(oldResource),
      new_data: toAuditJson(data),
    });
  } catch (auditError) {
    const rollbackError = await rollbackUpdateResource(supabase, resourceId, oldResource);
    return {
      success: false,
      error: withRollbackError(auditError, 'Failed to record updateBookingResource audit log', rollbackError),
    };
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true, data };
}

export async function deleteBookingResource(resourceId: string): Promise<BookingResourceDeleteResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: RESOURCE_MANAGE_ROLES,
    errorMessage: RESOURCE_AUTH_ERROR,
  });
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const supabase = await createClient();
  const { data: oldResource, error: existingError } = await supabase
    .from('booking_resources')
    .select('*')
    .eq('id', resourceId)
    .eq('tenant_id', auth.tenantId)
    .single();

  if (existingError) {
    return { success: false, error: existingError.message };
  }
  if (!oldResource) {
    return { success: false, error: 'Không tìm thấy tài nguyên đặt lịch.' };
  }

  const { error } = await supabase
    .from('booking_resources')
    .delete()
    .eq('id', resourceId)
    .eq('tenant_id', auth.tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'booking_resources',
      record_id: resourceId,
      old_data: toAuditJson(oldResource),
    });
  } catch (auditError) {
    const rollbackError = await rollbackDeleteResource(supabase, oldResource);
    return {
      success: false,
      error: withRollbackError(auditError, 'Failed to record deleteBookingResource audit log', rollbackError),
    };
  }

  safeRevalidatePath('/dashboard/services');
  return { success: true };
}
