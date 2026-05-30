'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkHqAuth } from './hq-actions';
import { HqAuditLogFilters, HqAuditLogRecord } from '@/types/domain';
import type { Database, Json } from '@/types/database.types';

export async function getHqAuditLogs(filters: HqAuditLogFilters = {}): Promise<HqAuditLogRecord[]> {
  const authResult = await checkHqAuth();
  if (!authResult.authorized) {
    throw new Error(authResult.error || 'Quyen truy cap bi tu choi');
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
    throw new Error(`[getHqAuditLogs] audit_logs query failed: ${error.message}`);
  }

  return (data || []).map((log: any) => ({
    id: log.id,
    created_at: log.created_at,
    changed_by_id: log.changed_by_id,
    user_name: log.users?.full_name || 'He thong',
    action: log.action,
    table_name: log.table_name,
    record_id: log.record_id,
    old_data: log.old_data,
    new_data: log.new_data,
    tenant_id: log.tenant_id,
    tenant_name: log.tenants?.name || 'Tong bo HQ'
  }));
}

export async function getAuditTables(): Promise<string[]> {
  const authResult = await checkHqAuth();
  if (!authResult.authorized) {
    throw new Error(authResult.error || 'Quyen truy cap bi tu choi');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('table_name');

  if (error) {
    throw new Error(`[getAuditTables] audit_logs query failed: ${error.message}`);
  }

  const tablesSet = new Set<string>((data || []).map(d => d.table_name).filter(Boolean));
  return Array.from(tablesSet).sort();
}

export async function getAuditUsers(): Promise<{ id: string; name: string }[]> {
  const authResult = await checkHqAuth();
  if (!authResult.authorized) {
    throw new Error(authResult.error || 'Quyen truy cap bi tu choi');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`[getAuditUsers] users query failed: ${error.message}`);
  }

  return (data || []).map((u: any) => ({ id: u.id, name: u.full_name || 'Khong ten' }));
}

export async function getAuditLogs() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('[getAuditLogs] Missing tenantId for current user');
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      users:changed_by_id(full_name)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`[getAuditLogs] audit_logs query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((log: any) => ({
    id: log.id,
    user_name: log.users?.full_name || 'He thong',
    action: log.action,
    table_name: log.table_name,
    record_id: log.record_id,
    old_data: log.old_data,
    new_data: log.new_data,
    created_at: log.created_at
  }));
}

export async function recordAuditLog(payload: {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: Json;
  new_data?: Json;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('[recordAuditLog] Missing tenantId for current user');
  }

  const auditPayload: Database['public']['Tables']['audit_logs']['Insert'] = {
    changed_by_id: currentUser?.id,
    action: payload.action,
    table_name: payload.table_name,
    record_id: payload.record_id,
    old_data: payload.old_data,
    new_data: payload.new_data,
    tenant_id: tenantId
  };

  const { error } = await supabase.from('audit_logs').insert(auditPayload);

  if (error) {
    throw new Error(`[recordAuditLog] Failed to insert audit log: ${error.message}`);
  }

  return { success: true };
}

export async function checkMonthLock(month?: string): Promise<{ isLocked: boolean }> {
  return { isLocked: false };
}
