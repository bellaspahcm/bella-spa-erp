
'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { HqAuditLogFilters, HqAuditLogRecord } from '@/types/domain';

export async function getHqAuditLogs(filters: HqAuditLogFilters = {}): Promise<HqAuditLogRecord[]> {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) {
      throw new Error(authResult.error || 'Quyền truy cập bị từ chối');
    }

    const supabase = await createClient();
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        users:changed_by_id(full_name),
        tenants:tenant_id(name)
      `);

    if (filters.tenantId && filters.tenantId !== 'all') {
      query = query.eq('tenant_id', filters.tenantId);
    }
    if (filters.userId && filters.userId !== 'all') {
      query = query.eq('changed_by_id', filters.userId);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.tableName && filters.tableName !== 'all') {
      query = query.eq('table_name', filters.tableName);
    }
    if (filters.startDate) {
      query = query.gte('created_at', new Date(filters.startDate).toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    const limit = filters.limit || 50;
    const page = filters.page || 1;
    const fromRange = (page - 1) * limit;
    const toRange = fromRange + limit - 1;

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (error) {
      console.error('[getHqAuditLogs] Supabase error:', error);
      throw error;
    }

    return (data || []).map((log: any) => ({
      id: log.id,
      created_at: log.created_at,
      changed_by_id: log.changed_by_id,
      user_name: log.users?.full_name || 'Hệ thống',
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
      old_data: log.old_data,
      new_data: log.new_data,
      tenant_id: log.tenant_id,
      tenant_name: log.tenants?.name || 'Tổng bộ HQ'
    }));
  } catch (error) {
    console.error('[getHqAuditLogs] Exception:', error);
    return [];
  }
}

export async function getAuditTables(): Promise<string[]> {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('table_name');

    if (error) throw error;
    const tablesSet = new Set<string>((data || []).map(d => d.table_name).filter(Boolean));
    return Array.from(tablesSet).sort();
  } catch (error) {
    console.error('[getAuditTables] Error:', error);
    return [];
  }
}

export async function getAuditUsers(): Promise<{ id: string; name: string }[]> {
  try {
    const authResult = await checkHqAuth();
    if (!authResult.authorized) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return (data || []).map((u: any) => ({ id: u.id, name: u.full_name || 'Không tên' }));
  } catch (error) {
    console.error('[getAuditUsers] Error:', error);
    return [];
  }
}

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
