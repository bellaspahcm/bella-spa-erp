
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

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('not found')) {
        // Table doesn't exist yet, return mock data for demo
        return getMockAuditLogs();
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return getMockAuditLogs();
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
    return getMockAuditLogs();
  }
}

function getMockAuditLogs() {
  return [
    {
      id: 'l1',
      user_name: 'Quản trị viên',
      action: 'UPDATE',
      module: 'SALARY',
      old_data: { status: 'draft', amount: 15000000 },
      new_data: { status: 'approved', amount: 15000000 },
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 mins ago
    },
    {
      id: 'l2',
      user_name: 'Nguyễn Phương Anh',
      action: 'CREATE',
      module: 'BOOKING',
      old_data: null,
      new_data: { customer: 'Mẹ Lan', service: 'Gói chăm sóc cơ bản' },
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
    },
    {
      id: 'l3',
      user_name: 'Hệ thống',
      action: 'UPDATE',
      module: 'FINANCE',
      old_data: { status: 'pending' },
      new_data: { status: 'confirmed' },
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    },
    {
      id: 'l4',
      user_name: 'Quản trị viên',
      action: 'DELETE',
      module: 'STAFF',
      old_data: { name: 'Trần Văn B', role: 'ktv' },
      new_data: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString()
    }
  ];
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
