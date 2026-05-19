'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';

export async function getTenantSettings() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

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
}) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    // Load old data for audit logs
    const oldSettings = await getTenantSettings();

    const { data, error } = await supabase
      .from('tenants')
      .update({
        name: settings.name,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        qr_bank_code: settings.qr_bank_code,
        qr_account_number: settings.qr_account_number,
        qr_account_name: settings.qr_account_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant settings:', error);
      return { success: false, error: error.message };
    }

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      old_data: oldSettings,
      new_data: data
    });

    revalidatePath('/dashboard/settings');
    return { success: true, data };
  } catch (error: any) {
    console.error('Exception saving tenant settings:', error);
    return { success: false, error: error.message || 'Lỗi không xác định' };
  }
}
