/**
 * PolicyAuditService - Audit Trail Management
 * 
 * Logs all policy changes for compliance (SOC 2, GDPR)
 */

import { createClient } from '@/lib/supabase/server';
import type {
  PolicyHistoryEntry,
  PolicyHistoryFilters,
  PolicyAction,
  LogAuditInput,
} from './types';
import { PAGINATION_DEFAULTS } from './constants';

export class PolicyAuditService {
  /**
   * Log a policy change to audit trail
   */
  static async logChange(input: LogAuditInput): Promise<PolicyHistoryEntry> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_history')
      .insert({
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
      })
      .select()
      .single();

    if (error) throw error;
    return mapDbToHistoryEntry(data);
  }

  /**
   * Get full history for a policy version
   */
  static async getHistory(
    policyId: string,
    version?: string
  ): Promise<PolicyHistoryEntry[]> {
    const supabase = await createClient();

    let query = supabase
      .from('policy_history')
      .select('*')
      .eq('policy_id', policyId);

    if (version) {
      query = query.eq('version', version);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDbToHistoryEntry);
  }

  /**
   * Query audit trail with filters
   */
  static async queryAuditTrail(
    filters?: PolicyHistoryFilters
  ): Promise<{ history: PolicyHistoryEntry[]; total: number }> {
    const supabase = await createClient();

    let query = supabase
      .from('policy_history')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.policyId) {
      query = query.eq('policy_id', filters.policyId);
    }
    if (filters?.version) {
      query = query.eq('version', filters.version);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    // Sorting (always by created_at desc)
    query = query.order('created_at', { ascending: false });

    // Pagination
    const limit = filters?.limit || PAGINATION_DEFAULTS.pageSize;
    const offset = filters?.offset || 0;
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
  static async getRecentChanges(limit: number = 50): Promise<PolicyHistoryEntry[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapDbToHistoryEntry);
  }

  /**
   * Get changes by user
   */
  static async getChangesByUser(userId: string, limit?: number): Promise<PolicyHistoryEntry[]> {
    const supabase = await createClient();

    let query = supabase
      .from('policy_history')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDbToHistoryEntry);
  }

  /**
   * Get changes by action type
   */
  static async getChangesByAction(
    action: PolicyAction,
    limit?: number
  ): Promise<PolicyHistoryEntry[]> {
    const supabase = await createClient();

    let query = supabase
      .from('policy_history')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDbToHistoryEntry);
  }

  /**
   * Helper: Log policy creation
   */
  static async logCreated(
    policyId: string,
    version: string,
    policyData: Record<string, unknown>,
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.logChange({
      policyId,
      version,
      action: 'created',
      oldValue: null,
      newValue: policyData,
      reason: reason || 'Policy created',
      userId,
    });
  }

  /**
   * Helper: Log status change
   */
  static async logStatusChange(
    policyId: string,
    version: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.logChange({
      policyId,
      version,
      action: 'updated',
      fieldChanged: 'status',
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
      userId,
    });
  }

  /**
   * Helper: Log field update
   */
  static async logFieldUpdate(
    policyId: string,
    version: string,
    field: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.logChange({
      policyId,
      version,
      action: 'updated',
      fieldChanged: field,
      oldValue: { [field]: oldValue },
      newValue: { [field]: newValue },
      reason: reason || `Updated ${field}`,
      userId,
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapDbToHistoryEntry(dbRow: Record<string, unknown>): PolicyHistoryEntry {
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
