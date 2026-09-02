/**
 * Outbox Repository
 * 
 * Database operations for runtime_outbox table
 * 
 * CRITICAL: Transactional outbox pattern
 * - Intent persisted atomically with business state
 * - At-least-once delivery guarantee
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  OutboxRecord,
  OutboxInsert,
  OutboxUpdate,
  OutboxStatus,
} from '../types/database.types';
import { FinancialIntent } from '../types/financial-intent.types';

/**
 * Outbox Repository
 * 
 * Manages transactional outbox (at-least-once delivery)
 */
export class OutboxRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Create Outbox Record
   * 
   * Insert Financial Intent into outbox (transactional)
   * 
   * CRITICAL: This MUST be called within same transaction as business state
   */
  async create(intent: FinancialIntent): Promise<OutboxRecord> {
    const record: OutboxInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      intent_payload: intent as any, // Full Financial Intent
      correlation_id: intent.correlationId,
      status: 'PENDING',
      delivery_attempts: 0,
      last_attempt_at: null,
      next_retry_at: null,
      last_error: null,
      published_at: undefined,
    };
    
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .insert(record)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create outbox record: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get Pending Intents
   * 
   * Poll for pending/failed intents ready for delivery
   * 
   * @param batchSize - Maximum number of intents to fetch
   * @returns Pending intents (ordered by creation time)
   */
  async getPendingIntents(batchSize: number = 10): Promise<OutboxRecord[]> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .select('*')
      .in('status', ['PENDING', 'FAILED'])
      .or(`next_retry_at.is.null,next_retry_at.lt.${now.toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(batchSize);
    
    if (error) {
      throw new Error(`Failed to get pending intents: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Update Status
   * 
   * Update outbox record status
   */
  async updateStatus(
    id: string,
    status: OutboxStatus,
    updates?: Partial<OutboxUpdate>
  ): Promise<OutboxRecord> {
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .update({ status, ...updates })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update outbox status: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Mark Processing
   * 
   * Mark intent as being processed
   */
  async markProcessing(id: string): Promise<OutboxRecord> {
    return this.updateStatus(id, 'PROCESSING', {
      last_attempt_at: new Date(),
    });
  }
  
  /**
   * Mark Published
   * 
   * Mark intent as successfully delivered
   */
  async markPublished(id: string): Promise<OutboxRecord> {
    return this.updateStatus(id, 'PUBLISHED', {
      published_at: new Date(),
    });
  }
  
  /**
   * Mark Failed
   * 
   * Mark intent delivery failed (will retry)
   */
  async markFailed(
    id: string,
    error: string,
    nextRetryAt: Date
  ): Promise<OutboxRecord> {
    const record = await this.getById(id);
    
    return this.updateStatus(id, 'FAILED', {
      delivery_attempts: record.delivery_attempts + 1,
      last_attempt_at: new Date(),
      last_error: error,
      next_retry_at: nextRetryAt,
    });
  }
  
  /**
   * Mark Quarantined
   * 
   * Mark intent as poison message (requires manual intervention)
   */
  async markQuarantined(id: string, error: string): Promise<OutboxRecord> {
    const record = await this.getById(id);
    
    return this.updateStatus(id, 'QUARANTINED', {
      delivery_attempts: record.delivery_attempts + 1,
      last_attempt_at: new Date(),
      last_error: error,
    });
  }
  
  /**
   * Get by ID
   * 
   * Retrieve outbox record
   */
  async getById(id: string): Promise<OutboxRecord> {
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      throw new Error(`Outbox record not found: ${id}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get by Correlation ID
   * 
   * Find all intents with same correlation ID (for tracing)
   */
  async getByCorrelationId(correlationId: string): Promise<OutboxRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get correlation records: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Tenant
   * 
   * List all outbox records for tenant
   */
  async getByTenant(
    tenantId: string,
    status?: OutboxStatus
  ): Promise<OutboxRecord[]> {
    let query = this.supabase
      .from('runtime_outbox')
      .select('*')
      .eq('tenant_id', tenantId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get tenant records: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Status
   * 
   * List all outbox records with specific status
   */
  async getByStatus(status: OutboxStatus, limit?: number): Promise<OutboxRecord[]> {
    let query = this.supabase
      .from('runtime_outbox')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get records by status: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Claim for Processing
   * 
   * Atomically claim an outbox record for processing (optimistic lock)
   * Uses version field to prevent double-processing
   */
  async claimForProcessing(id: string): Promise<OutboxRecord> {
    // Get current record
    const current = await this.getById(id);
    
    if (current.status !== 'PENDING') {
      throw new Error(`Cannot claim record with status ${current.status}`);
    }
    
    // Attempt to update with optimistic lock
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .update({
        status: 'PROCESSING',
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'PENDING') // Optimistic lock: only update if still PENDING
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to claim record: already claimed or not found`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Reschedule
   * 
   * Reschedule a failed record for retry
   */
  async reschedule(id: string, retryAt: Date): Promise<OutboxRecord> {
    return this.updateStatus(id, 'PENDING', {
      next_retry_at: retryAt,
    });
  }
  
  /**
   * Get Stale Records
   * 
   * Find intents stuck in PROCESSING (worker crash detection)
   * 
   * @param staleThresholdMs - Milliseconds to consider record stale
   */
  async getStaleRecords(staleThresholdMs: number): Promise<OutboxRecord[]> {
    const threshold = new Date(Date.now() - staleThresholdMs);
    
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .select('*')
      .eq('status', 'PROCESSING')
      .lt('last_attempt_at', threshold.toISOString());
    
    if (error) {
      throw new Error(`Failed to get stale records: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Reset Stale Records
   * 
   * Reset stale PROCESSING records to PENDING (for retry)
   */
  async resetStaleRecords(staleThresholdMs: number): Promise<number> {
    const staleRecords = await this.getStaleRecords(staleThresholdMs);
    
    for (const record of staleRecords) {
      await this.updateStatus(record.id, 'PENDING');
    }
    
    return staleRecords.length;
  }
  
  /**
   * Get Stats
   * 
   * Outbox statistics (for monitoring)
   * 
   * @param tenantId - Optional tenant filter
   */
  async getStats(tenantId?: string): Promise<{
    pending: number;
    processing: number;
    published: number;
    failed: number;
    quarantined?: number;
  }> {
    let query = this.supabase
      .from('runtime_outbox')
      .select('status');
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
    
    const stats = {
      pending: 0,
      processing: 0,
      published: 0,
      failed: 0,
      quarantined: 0,
    };
    
    for (const record of data || []) {
      const status = record.status.toLowerCase();
      if (status in stats) {
        stats[status as keyof typeof stats]++;
      }
    }
    
    return stats;
  }
  
  /**
   * Get Detailed Stats
   * 
   * Detailed outbox statistics (for monitoring)
   */
  async getDetailedStats(): Promise<{
    totalRecords: number;
    byStatus: Map<OutboxStatus, number>;
    byTenant: Map<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('runtime_outbox')
      .select('status, tenant_id');
    
    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
    
    const byStatus = new Map<OutboxStatus, number>();
    const byTenant = new Map<string, number>();
    
    for (const record of data || []) {
      // Count by status
      const statusCount = byStatus.get(record.status) || 0;
      byStatus.set(record.status, statusCount + 1);
      
      // Count by tenant
      const tenantCount = byTenant.get(record.tenant_id) || 0;
      byTenant.set(record.tenant_id, tenantCount + 1);
    }
    
    return {
      totalRecords: data?.length || 0,
      byStatus,
      byTenant,
    };
  }
  
  /**
   * Map database row to record
   */
  private mapToRecord(data: any): OutboxRecord {
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      intent_type: data.intent_type,
      intent_payload: data.intent_payload,
      correlation_id: data.correlation_id,
      status: data.status,
      delivery_attempts: data.delivery_attempts,
      last_attempt_at: data.last_attempt_at ? new Date(data.last_attempt_at) : null,
      next_retry_at: data.next_retry_at ? new Date(data.next_retry_at) : null,
      last_error: data.last_error,
      created_at: new Date(data.created_at),
      published_at: data.published_at ? new Date(data.published_at) : null,
    };
  }
}
