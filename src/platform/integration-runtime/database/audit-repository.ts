/**
 * Audit Repository
 * 
 * Database operations for runtime_audit_log table
 * 
 * CRITICAL: APPEND-ONLY
 * - No UPDATE allowed
 * - No DELETE allowed
 * - Enforced at database level (RLS policies)
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  AuditLogRecord,
  AuditLogInsert,
  AuditStatus,
} from '../types/database.types';
import { FinancialIntent } from '../types/financial-intent.types';

/**
 * Audit Repository
 * 
 * Manages audit log (append-only, immutable)
 */
export class AuditRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Log Success
   * 
   * Record successfully published intent
   */
  async logSuccess(intent: FinancialIntent, outboxId: string): Promise<AuditLogRecord> {
    const record: AuditLogInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      entity_id: intent.entityId,
      entity_type: intent.entityType,
      amount: intent.amount,
      currency: intent.currency,
      correlation_id: intent.correlationId,
      source: intent.source,
      status: 'SUCCESS',
      delivery_attempts: null,
      failure_reason: null,
      quarantined_at: null,
    };
    
    return this.insert(record);
  }
  
  /**
   * Log Retrying
   * 
   * Record intent retry attempt
   */
  async logRetrying(
    intent: FinancialIntent,
    attempts: number,
    reason: string
  ): Promise<AuditLogRecord> {
    const record: AuditLogInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      entity_id: intent.entityId,
      entity_type: intent.entityType,
      amount: intent.amount,
      currency: intent.currency,
      correlation_id: intent.correlationId,
      source: intent.source,
      status: 'RETRYING',
      delivery_attempts: attempts,
      failure_reason: reason,
      quarantined_at: null,
    };
    
    return this.insert(record);
  }
  
  /**
   * Log Invalid
   * 
   * Record validation failure
   */
  async logInvalid(
    intent: Partial<FinancialIntent>,
    reason: string
  ): Promise<AuditLogRecord> {
    const record: AuditLogInsert = {
      tenant_id: intent.tenantId || 'unknown',
      intent_type: intent.intentType || 'unknown',
      entity_id: intent.entityId || 'unknown',
      entity_type: intent.entityType || 'unknown',
      amount: intent.amount || 0,
      currency: intent.currency || 'XXX',
      correlation_id: intent.correlationId || 'unknown',
      source: intent.source || 'unknown',
      status: 'INVALID',
      delivery_attempts: null,
      failure_reason: reason,
      quarantined_at: null,
    };
    
    return this.insert(record);
  }
  
  /**
   * Log Duplicate
   * 
   * Record idempotency rejection (not a failure)
   */
  async logDuplicate(intent: FinancialIntent): Promise<AuditLogRecord> {
    const record: AuditLogInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      entity_id: intent.entityId,
      entity_type: intent.entityType,
      amount: intent.amount,
      currency: intent.currency,
      correlation_id: intent.correlationId,
      source: intent.source,
      status: 'DUPLICATE',
      delivery_attempts: null,
      failure_reason: 'Duplicate intent (idempotency)',
      quarantined_at: null,
    };
    
    return this.insert(record);
  }
  
  /**
   * Log Quarantined
   * 
   * Record intent quarantine
   */
  async logQuarantined(
    intent: FinancialIntent,
    attempts: number,
    reason: string
  ): Promise<AuditLogRecord> {
    const record: AuditLogInsert = {
      tenant_id: intent.tenantId,
      intent_type: intent.intentType,
      entity_id: intent.entityId,
      entity_type: intent.entityType,
      amount: intent.amount,
      currency: intent.currency,
      correlation_id: intent.correlationId,
      source: intent.source,
      status: 'QUARANTINED',
      delivery_attempts: attempts,
      failure_reason: reason,
      quarantined_at: new Date(),
    };
    
    return this.insert(record);
  }
  
  /**
   * Insert Audit Record
   * 
   * APPEND-ONLY: Cannot update after insert
   */
  private async insert(record: AuditLogInsert): Promise<AuditLogRecord> {
    const { data, error } = await this.supabase
      .from('runtime_audit_log')
      .insert(record)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to insert audit log: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get by Correlation ID
   * 
   * Trace full history of correlation chain
   */
  async getByCorrelationId(correlationId: string): Promise<AuditLogRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_audit_log')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get audit by correlation: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Tenant
   * 
   * List audit log for tenant
   */
  async getByTenant(
    tenantId: string,
    status?: AuditStatus,
    limit?: number
  ): Promise<AuditLogRecord[]> {
    let query = this.supabase
      .from('runtime_audit_log')
      .select('*')
      .eq('tenant_id', tenantId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query.order('timestamp', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get audit by tenant: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get by Entity
   * 
   * Trace audit log for specific entity
   */
  async getByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditLogRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get audit by entity: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get Recent
   * 
   * Get most recent audit records (for monitoring)
   */
  async getRecent(limit: number = 100): Promise<AuditLogRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get recent audit: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get Stats
   * 
   * Audit log statistics (for monitoring)
   */
  async getStats(tenantId?: string): Promise<{
    totalRecords: number;
    byStatus: Map<AuditStatus, number>;
    successRate: number;
  }> {
    let query = this.supabase
      .from('runtime_audit_log')
      .select('status');
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get audit stats: ${error.message}`);
    }
    
    const byStatus = new Map<AuditStatus, number>();
    for (const record of data || []) {
      const count = byStatus.get(record.status) || 0;
      byStatus.set(record.status, count + 1);
    }
    
    const totalRecords = data?.length || 0;
    const successCount = byStatus.get('SUCCESS') || 0;
    const successRate = totalRecords > 0 ? successCount / totalRecords : 0;
    
    return {
      totalRecords,
      byStatus,
      successRate,
    };
  }
  
  /**
   * Map database row to record
   */
  private mapToRecord(data: any): AuditLogRecord {
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      intent_type: data.intent_type,
      entity_id: data.entity_id,
      entity_type: data.entity_type,
      amount: parseFloat(data.amount),
      currency: data.currency,
      correlation_id: data.correlation_id,
      source: data.source,
      status: data.status,
      delivery_attempts: data.delivery_attempts,
      failure_reason: data.failure_reason,
      quarantined_at: data.quarantined_at ? new Date(data.quarantined_at) : null,
      timestamp: new Date(data.timestamp),
    };
  }
}
