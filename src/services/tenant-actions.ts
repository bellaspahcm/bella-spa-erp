'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';
import type { Database, Json } from '@/types/database.types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type TenantSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

function getAdminTenantClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey);
}

async function fetchTenantSnapshot(
  supabase: TenantSupabaseClient,
  tenantId: string,
): Promise<{ data: TenantRow | null; error: string | null }> {
  let { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if ((error || !data) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = getAdminTenantClient();
    if (supabaseAdmin) {
      const adminRes = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      data = adminRes.data;
      error = adminRes.error;
    }
  }

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: 'Tenant not found' };
  }

  return { data: data as TenantRow, error: null };
}

function mapTenantSettingsRollbackPayload(snapshot: TenantRow): TenantUpdate {
  return {
    name: snapshot.name,
    contact_phone: snapshot.contact_phone,
    email: snapshot.email,
    address: snapshot.address,
    qr_bank_code: snapshot.qr_bank_code,
    qr_account_number: snapshot.qr_account_number,
    qr_account_name: snapshot.qr_account_name,
    salary_config: snapshot.salary_config,
    role_permissions: snapshot.role_permissions,
    updated_at: snapshot.updated_at,
  };
}

async function rollbackTenantSettings(
  supabase: TenantSupabaseClient,
  tenantId: string,
  snapshot: TenantRow,
) {
  const { error } = await supabase
    .from('tenants')
    .update(mapTenantSettingsRollbackPayload(snapshot))
    .eq('id', tenantId);

  return error?.message || '';
}

export async function getTenantSettings() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[getTenantSettings] Không có tenantId cho người dùng hiện tại');
    return null;
  }

  try {
    let { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Error fetching tenant settings with auth client, trying with admin client...', error.message);
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const adminRes = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
        
      data = adminRes.data;
      error = adminRes.error;
    }

    if (error) {
      console.error('Error fetching tenant settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching tenant settings:', error);
    return null;
  }
}

export async function saveTenantSettings(settings: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  qr_bank_code?: string;
  qr_account_number?: string;
  qr_account_name?: string;
  salary_config?: Json;
  role_permissions?: Json;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng' };
  }

  try {
    const { data: oldSettings, error: snapshotError } = await fetchTenantSnapshot(supabase, tenantId);
    if (snapshotError || !oldSettings) {
      return {
        success: false,
        error: `Failed to snapshot tenant settings: ${snapshotError || 'Tenant not found'}`,
      };
    }

    const updatePayload: TenantUpdate = { updated_at: new Date().toISOString() };
    if (settings.name !== undefined) updatePayload.name = settings.name;
    if (settings.phone !== undefined) updatePayload.contact_phone = settings.phone;
    if (settings.email !== undefined) updatePayload.email = settings.email;
    if (settings.address !== undefined) updatePayload.address = settings.address;
    if (settings.qr_bank_code !== undefined) updatePayload.qr_bank_code = settings.qr_bank_code;
    if (settings.qr_account_number !== undefined) updatePayload.qr_account_number = settings.qr_account_number;
    if (settings.qr_account_name !== undefined) updatePayload.qr_account_name = settings.qr_account_name;
    if (settings.salary_config !== undefined) updatePayload.salary_config = settings.salary_config;
    if (settings.role_permissions !== undefined) updatePayload.role_permissions = settings.role_permissions;

    let { data, error } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenantId)
      .select();

    if ((!data || data.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Update returned 0 rows with auth client, trying with admin client...');
      const supabaseAdmin = getAdminTenantClient();
      if (!supabaseAdmin) {
        return { success: false, error: 'Không thể tạo Supabase admin client để cập nhật cấu hình chi nhánh.' };
      }
      
      const adminRes = await supabaseAdmin
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenantId)
        .select();
        
      data = adminRes.data;
      error = adminRes.error;
    }

    if (error) {
      console.error('Error updating tenant settings:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error('Update returned 0 rows for tenant_id:', tenantId);
      return { success: false, error: 'Không thể cập nhật cấu hình, chi nhánh không tồn tại hoặc bị chặn bởi quyền truy cập.' };
    }

    const updatedTenant = data[0];

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'tenants',
        record_id: tenantId,
        old_data: oldSettings,
        new_data: updatedTenant
      });
    } catch (auditError: unknown) {
      const rollbackError = await rollbackTenantSettings(supabase, tenantId, oldSettings);
      const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
      return {
        success: false,
        error: `Failed to record tenant settings audit log: ${getErrorMessage(auditError)}${rollbackNote}`,
      };
    }

    revalidatePath('/dashboard/settings');
    return { success: true, data: updatedTenant };
  } catch (error: unknown) {
    console.error('Exception saving tenant settings:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
