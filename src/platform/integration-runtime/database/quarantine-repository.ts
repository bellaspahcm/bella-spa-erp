/**
 * Quarantine Repository
 * 
 * Database operations for runtime_quarantine table
 * 
 * Purpose: Store poison messages for investigation and controlled replay
 * 
 * CRITICAL: Preserves full payload + error context
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  QuarantineRecord,
  QuarantineInsert,
  QuarantineUpdate,
  QuarantineResolution,
} from '../types/database.types';
import { FinancialIntent } from '../types/financial-intent.types';

/**
 * Quarantine Repository
 * 
 * Manages poison message quarantine
 */
export class QuarantineRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Quarantine Intent
   * 
   * Store failed intent for investigation
   */
  async quarantine(
    intent: FinancialIntent,
    failureReason: string,
    attempts: number,
    lastError: string,
    outboxId?: string
  ): Promise<QuarantineRecord> {
    const record: QuarantineInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      intent_payload: intent as any, // Full Financial Intent preserved
      correlation_id: intent.correlationId,
      failure_reason: failureReason,
      attempts,
      last_error: lastError,
      outbox_id: outboxId || null,
    };
    
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .insert(record)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to quarantine intent: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get by ID
   * 
   * Retrieve quarantined intent
   */
  async getById(id: string): Promise<QuarantineRecord> {
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      throw new Error(`Quarantine record not found: ${id}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get Unreviewed
   * 
   * List quarantined intents pending review
   */
  async getUnreviewed(tenantId?: string): Promise<QuarantineRecord[]> {
    let query = this.supabase
      .from('runtime_quarantine')
      .select('*')
      .eq('reviewed', false);
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query.order('quarantined_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get unreviewed quarantine: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Tenant
   * 
   * List all quarantined intents for tenant
   */
  async getByTenant(tenantId: string): Promise<QuarantineRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('quarantined_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get tenant quarantine: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Correlation ID
   * 
   * Find quarantined intents by correlation ID
   */
  async getByCorrelationId(correlationId: string): Promise<QuarantineRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('quarantined_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get correlation quarantine: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Mark Reviewed
   * 
   * Mark quarantine record as reviewed
   */
  async markReviewed(
    id: string,
    reviewedBy: string,
    resolution: QuarantineResolution
  ): Promise<QuarantineRecord> {
    const updates: QuarantineUpdate = {
      reviewed: true,
      reviewed_at: new Date(),
      reviewed_by: reviewedBy,
      resolution,
    };
    
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to mark reviewed: ${error?.message || 'Unknown error'}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Mark Replayed
   * 
   * Mark intent as successfully replayed
   */
  async markReplayed(id: string, reviewedBy: string): Promise<QuarantineRecord> {
    return this.markReviewed(id, reviewedBy, 'REPLAYED');
  }
  
  /**
   * Mark Discarded
   * 
   * Mark intent as invalid/discarded
   */
  async markDiscarded(id: string, reviewedBy: string): Promise<QuarantineRecord> {
    return this.markReviewed(id, reviewedBy, 'DISCARDED');
  }
  
  /**
   * Mark Fixed
   * 
   * Mark intent as corrected and replayed
   */
  async markFixed(id: string, reviewedBy: string): Promise<QuarantineRecord> {
    return this.markReviewed(id, reviewedBy, 'FIXED');
  }
  
  /**
   * Get Recent
   * 
   * Get most recent quarantine records (for monitoring)
   */
  async getRecent(limit: number = 100): Promise<QuarantineRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_quarantine')
      .select('*')
      .order('quarantined_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get recent quarantine: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get Stats
   * 
   * Quarantine statistics (for monitoring)
   */
  async getStats(tenantId?: string): Promise<{
    totalRecords: number;
    unreviewed: number;
    byResolution: Map<QuarantineResolution, number>;
  }> {
    let query = this.supabase
      .from('runtime_quarantine')
      .select('reviewed, resolution');
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get quarantine stats: ${error.message}`);
    }
    
    const byResolution = new Map<QuarantineResolution, number>();
    let unreviewed = 0;
    
    for (const record of data || []) {
      if (!record.reviewed) {
        unreviewed++;
      } else if (record.resolution) {
        const count = byResolution.get(record.resolution) || 0;
        byResolution.set(record.resolution, count + 1);
      }
    }
    
    return {
      totalRecords: data?.length || 0,
      unreviewed,
      byResolution,
    };
  }
  
  /**
   * Cleanup Old Records
   * 
   * Delete reviewed records older than retention period
   * 
   * @param retentionDays - Days to retain reviewed records
   * @returns Number of records deleted
   */
  async cleanupOld(retentionDays: number): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - retentionDays);
    
    const { count, error } = await this.supabase
      .from('runtime_quarantine')
      .delete({ count: 'exact' })
      .eq('reviewed', true)
      .lt('reviewed_at', threshold.toISOString());
    
    if (error) {
      throw new Error(`Failed to cleanup quarantine: ${error.message}`);
    }
    
    return count || 0;
  }
  
  /**
   * Map database row to record
   */
  private mapToRecord(data: any): QuarantineRecord {
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      intent_type: data.intent_type,
      intent_payload: data.intent_payload,
      correlation_id: data.correlation_id,
      failure_reason: data.failure_reason,
      attempts: data.attempts,
      last_error: data.last_error,
      quarantined_at: new Date(data.quarantined_at),
      reviewed: data.reviewed,
      reviewed_at: data.reviewed_at ? new Date(data.reviewed_at) : null,
      reviewed_by: data.reviewed_by,
      resolution: data.resolution,
      outbox_id: data.outbox_id,
    };
  }
}
