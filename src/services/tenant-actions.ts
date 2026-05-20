'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';

export async function getTenantSettings() {
  const supabase = (await createClient()) as any;
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
  salary_config?: any;
  role_permissions?: any;
}) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng' };
  }

  try {
    // Load old data for audit logs
    const oldSettings = await getTenantSettings();

    const updatePayload: any = { updated_at: new Date().toISOString() };
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
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
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

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      old_data: oldSettings,
      new_data: updatedTenant
    });

    revalidatePath('/dashboard/settings');
    return { success: true, data: updatedTenant };
  } catch (error: any) {
    console.error('Exception saving tenant settings:', error);
    return { success: false, error: error.message || 'Lỗi không xác định' };
  }
}
