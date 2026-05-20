
'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

export async function getAuditLogs() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[getAuditLogs] Không có tenantId cho người dùng hiện tại');
    return [];
  }

  try {
    // Note: audit_logs.changed_by_id points to auth.users.id. 
    // We usually have a mapping in public.users.id as well.
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users:changed_by_id(full_name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching audit logs:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((log: any) => ({
      id: log.id,
      user_name: log.users?.full_name || 'Hệ thống',
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
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
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[recordAuditLog] Không tìm thấy tenantId cho người dùng hiện tại, bỏ qua ghi log');
    return;
  }

  try {
    const { error } = await supabase.from('audit_logs').insert({
      changed_by_id: currentUser?.id,
      action: payload.action,
      table_name: payload.table_name,
      record_id: payload.record_id,
      old_data: payload.old_data,
      new_data: payload.new_data,
      tenant_id: tenantId
    });

    if (error) {
      console.warn('Failed to record audit log:', error.message);
    }
  } catch (err) {
    console.error('Audit log recording failed:', err);
  }
}
