/**
 * Bella Auto Phase 10 - Offline Sync Service
 * 
 * Manages offline action queue and synchronization for PWA.
 * 
 * Features:
 * - Queue offline actions
 * - Sync actions when online
 * - Conflict resolution
 * - Priority-based sync
 * - Retry logic
 * 
 * @module bella-auto/services/mobile/OfflineSyncService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type OfflineAction = Database['public']['Tables']['auto_offline_actions']['Row'];
type OfflineActionInsert = Database['public']['Tables']['auto_offline_actions']['Insert'];
type OfflineActionUpdate = Database['public']['Tables']['auto_offline_actions']['Update'];

type ActionType =
  | 'lead_capture'
  | 'test_drive_log'
  | 'quotation_create'
  | 'service_appointment_create'
  | 'repair_order_update'
  | 'photo_capture'
  | 'parts_request'
  | 'job_complete'
  | 'customer_note';

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
type ConflictResolution = 'client_wins' | 'server_wins' | 'manual';

interface QueueActionParams {
  tenantId: string;
  userId: string;
  sessionId?: string;
  actionType: ActionType;
  entityType: string;
  actionData: unknown;
  priority?: number;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  errors: Array<{ actionId: string; error: string }>;
}

export class OfflineSyncService {
  /**
   * Queue action for offline sync
   */
  static async queueAction(params: QueueActionParams): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const actionData: OfflineActionInsert = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      session_id: params.sessionId,
      action_type: params.actionType,
      entity_type: params.entityType,
      action_data: params.actionData as Database['public']['Tables']['auto_offline_actions']['Row']['action_data'],
      priority: params.priority || 5,
      status: 'pending',
      sync_attempts: 0,
    };
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .insert(actionData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to queue offline action: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get pending actions for user (using RPC for efficiency)
   */
  static async getPendingActions(
    tenantId: string,
    userId: string,
    limit: number = 50
  ) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('get_pending_offline_actions', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_limit: limit,
      });
    
    if (error) {
      throw new Error(`Failed to fetch pending actions: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Mark action as syncing (lock for processing)
   */
  static async markSyncing(actionId: string, tenantId: string): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    // First get current sync_attempts
    const { data: current } = await supabase
      .from('auto_offline_actions')
      .select('sync_attempts')
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .single();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        status: 'syncing',
        last_sync_attempt_at: new Date().toISOString(),
        sync_attempts: (current?.sync_attempts || 0) + 1,
      })
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending') // Only update if still pending
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark action as syncing: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark action as synced
   */
  static async markSynced(
    actionId: string,
    tenantId: string,
    entityId?: string
  ): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const updates: OfflineActionUpdate = {
      status: 'synced',
      synced_at: new Date().toISOString(),
    };
    
    if (entityId) {
      updates.entity_id = entityId;
    }
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update(updates)
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark action as synced: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark action as failed
   */
  static async markFailed(
    actionId: string,
    tenantId: string,
    errorMessage: string
  ): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        status: 'failed',
        sync_error: errorMessage,
        last_sync_attempt_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark action as failed: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark action as conflict
   */
  static async markConflict(
    actionId: string,
    tenantId: string,
    conflictReason: string
  ): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        status: 'conflict',
        sync_error: conflictReason,
        last_sync_attempt_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark action as conflict: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Resolve conflict
   */
  static async resolveConflict(
    actionId: string,
    tenantId: string,
    resolution: ConflictResolution,
    resolvedBy: string
  ): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        conflict_resolution: resolution,
        conflict_resolved_at: new Date().toISOString(),
        conflict_resolved_by: resolvedBy,
        status: resolution === 'manual' ? 'pending' : 'synced', // Reset to pending if manual
      })
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .eq('status', 'conflict')
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to resolve conflict: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Retry failed action (reset to pending)
   */
  static async retryAction(actionId: string, tenantId: string): Promise<OfflineAction> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        status: 'pending',
        sync_error: null,
      })
      .eq('id', actionId)
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to retry action: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get sync statistics
   */
  static async getStatistics(tenantId: string, userId?: string) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_offline_actions')
      .select('status, action_type, sync_attempts')
      .eq('tenant_id', tenantId);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch sync statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      conflict: 0,
      byActionType: {} as Record<string, number>,
      averageAttempts: 0,
    };
    
    let totalAttempts = 0;
    
    data.forEach(action => {
      // Count by status
      if (action.status === 'pending') stats.pending++;
      else if (action.status === 'syncing') stats.syncing++;
      else if (action.status === 'synced') stats.synced++;
      else if (action.status === 'failed') stats.failed++;
      else if (action.status === 'conflict') stats.conflict++;
      
      // Count by action type
      stats.byActionType[action.action_type] = (stats.byActionType[action.action_type] || 0) + 1;
      
      // Average attempts
      totalAttempts += action.sync_attempts ?? 0;
    });
    
    stats.averageAttempts = data.length > 0 ? totalAttempts / data.length : 0;
    
    return stats;
  }
  
  /**
   * Cleanup synced actions (retention policy)
   */
  static async cleanupSyncedActions(tenantId: string, daysToKeep: number = 7): Promise<number> {
    const supabase = getPrimaryClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('status', 'synced')
      .lt('synced_at', cutoffDate.toISOString())
      .select();
    
    if (error) {
      throw new Error(`Failed to cleanup synced actions: ${error.message}`);
    }
    
    return data?.length || 0;
  }
  
  /**
   * Get conflicts requiring manual resolution
   */
  static async getConflicts(tenantId: string, userId?: string): Promise<OfflineAction[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_offline_actions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'conflict')
      .is('conflict_resolved_at', null)
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch conflicts: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get failed actions (for retry dashboard)
   */
  static async getFailedActions(tenantId: string, userId?: string): Promise<OfflineAction[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_offline_actions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch failed actions: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Batch retry all failed actions for user
   */
  static async retryAllFailed(tenantId: string, userId: string): Promise<number> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_offline_actions')
      .update({
        status: 'pending',
        sync_error: null,
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'failed')
      .select();
    
    if (error) {
      throw new Error(`Failed to retry all failed actions: ${error.message}`);
    }
    
    return data?.length || 0;
  }
}
