/**
 * Audit Utilities
 * 
 * Simple helper functions for audit trail management.
 * This is a cross-cutting concern, not business logic.
 * 
 * Extraction Rule:
 * Keep as utility module. Do NOT extract to AuditService unless:
 * - Audit logic exceeds 300 LOC
 * - Requires integration with external audit systems (SIEM, log aggregation)
 * - Needs independent scaling/deployment
 */

import { createClient } from '@/lib/supabase-server';
import type { PolicyAction, PolicyHistoryEntry } from './types';

// ============================================================================
// WRITE AUDIT
// ============================================================================

export interface WriteAuditInput {
  policyId: string;
  version: string;
  action: PolicyAction;
  fieldChanged?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write audit log entry
 * 
 * All policy changes must be logged for compliance (SOC 2, GDPR)
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('policy_history').insert({
    policy_id: input.policyId,
    version: input.version,
    action: input.action,
    field_changed: input.fieldChanged,
    old_value: input.oldValue,
    new_value: input.newValue,
    reason: input.reason,
    created_by: input.userId,
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
  });

  if (error) {
    console.error('Failed to write audit log:', error);
    throw error;
  }
}

// ============================================================================
// READ AUDIT
// ============================================================================

export interface GetHistoryOptions {
  policyId: string;
  version?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get audit history for a policy
 */
export async function getHistory(
  options: GetHistoryOptions
): Promise<PolicyHistoryEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from('policy_history')
    .select('*')
    .eq('policy_id', options.policyId);

  if (options.version) {
    query = query.eq('version', options.version);
  }

  query = query.order('created_at', { ascending: false });

  if (options.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(mapDbToHistoryEntry);
}

export interface QueryHistoryOptions {
  policyId?: string;
  version?: string;
  action?: PolicyAction;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query audit trail with filters
 */
export async function queryHistory(
  options: QueryHistoryOptions
): Promise<{ history: PolicyHistoryEntry[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from('policy_history')
    .select('*', { count: 'exact' });

  // Apply filters
  if (options.policyId) {
    query = query.eq('policy_id', options.policyId);
  }
  if (options.version) {
    query = query.eq('version', options.version);
  }
  if (options.action) {
    query = query.eq('action', options.action);
  }
  if (options.createdBy) {
    query = query.eq('created_by', options.createdBy);
  }
  if (options.dateFrom) {
    query = query.gte('created_at', options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte('created_at', options.dateTo);
  }

  query = query.order('created_at', { ascending: false });

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    history: (data || []).map(mapDbToHistoryEntry),
    total: count || 0,
  };
}

/**
 * Get recent changes (last N changes)
 */
export async function getRecentChanges(limit: number = 50): Promise<PolicyHistoryEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('policy_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(mapDbToHistoryEntry);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapDbToHistoryEntry(dbRow: any): PolicyHistoryEntry {
  return {
    id: dbRow.id,
    policyId: dbRow.policy_id,
    version: dbRow.version,
    action: dbRow.action,
    fieldChanged: dbRow.field_changed,
    oldValue: dbRow.old_value,
    newValue: dbRow.new_value,
    reason: dbRow.reason,
    createdAt: dbRow.created_at,
    createdBy: dbRow.created_by,
    ipAddress: dbRow.ip_address,
    userAgent: dbRow.user_agent,
  };
}
