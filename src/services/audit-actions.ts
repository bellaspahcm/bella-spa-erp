
'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

export async function getAuditLogs() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users(full_name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((log: any) => ({
      id: log.id,
      user_name: log.users?.full_name || 'Hệ thống',
      action: log.action,
      module: log.module,
      old_data: log.old_data,
      new_data: log.new_data,
      created_at: log.created_at
    }));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}



export async function recordAuditLog(payload: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  module: string;
  target_id: string;
  old_data?: any;
  new_data?: any;
}) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: currentUser?.id,
      action: payload.action,
      module: payload.module,
      target_id: payload.target_id,
      old_data: payload.old_data,
      new_data: payload.new_data,
      tenant_id: tenantId
    });

    if (error) {
      console.warn('Failed to record audit log (table might be missing):', error.message);
    }
  } catch (err) {
    console.error('Audit log recording failed:', err);
  }
}
