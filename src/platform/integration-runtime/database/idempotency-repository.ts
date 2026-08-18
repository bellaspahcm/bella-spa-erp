/**
 * Idempotency Repository
 * 
 * Database operations for runtime_idempotency_registry table
 * 
 * CRITICAL: Tenant-scoped uniqueness constraint enforced at DB level
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  IdempotencyRegistryRecord,
  IdempotencyRegistryInsert,
} from '../types/database.types';
import { IdempotencyError, buildErrorContext } from '../types/runtime-errors.types';

/**
 * Idempotency Repository
 * 
 * Manages idempotency registry (duplicate detection)
 */
export class IdempotencyRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Check Idempotency
   * 
   * Check if intent already processed (within TTL)
   * 
   * @returns Existing record if duplicate, null otherwise
   */
  async check(
    tenantId: string,
    idempotencyKey: string
  ): Promise<IdempotencyRegistryRecord | null> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .gt('expires_at', now.toISOString())
      .single();
    
    if (error) {
      // Not found = not a duplicate (expected)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Idempotency check failed: ${error.message}`);
    }
    
    return data ? this.mapToRecord(data) : null;
  }
  
  /**
   * Register Intent
   * 
   * Register successfully processed intent
   * 
   * @throws Error if duplicate (unique constraint violation)
   */
  async register(record: IdempotencyRegistryInsert): Promise<IdempotencyRegistryRecord> {
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .insert(record)
      .select()
      .single();
    
    if (error) {
      // Unique constraint violation = duplicate
      if (error.code === '23505') {
        throw new IdempotencyError(
          record.idempotency_key,
          'unknown', // Cannot determine original outbox ID from constraint error
          buildErrorContext(
            { tenantId: record.tenant_id, correlationId: record.correlation_id } as any,
            error,
            { record }
          )
        );
      }
      throw new Error(`Failed to register idempotency: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Check and Register (Atomic)
   * 
   * Check idempotency and register if new
   * 
   * @returns Existing record if duplicate, null if registered
   * @throws Error on database error
   */
  async checkAndRegister(
    record: IdempotencyRegistryInsert
  ): Promise<IdempotencyRegistryRecord | null> {
    // Check first
    const existing = await this.check(record.tenant_id, record.idempotency_key);
    if (existing) {
      return existing;
    }
    
    // Register (may throw IdempotencyError if race condition)
    try {
      await this.register(record);
      return null;
    } catch (error) {
      if (error instanceof IdempotencyError) {
        // Race condition: another process registered between check and insert
        // Re-check to get the winning record
        const winner = await this.check(record.tenant_id, record.idempotency_key);
        return winner;
      }
      throw error;
    }
  }
  
  /**
   * Get Record
   * 
   * Retrieve idempotency record by key
   */
  async getRecord(
    tenantId: string,
    idempotencyKey: string
  ): Promise<IdempotencyRegistryRecord | null> {
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get idempotency record: ${error.message}`);
    }
    
    return data ? this.mapToRecord(data) : null;
  }
  
  /**
   * Get Records by Tenant
   * 
   * List all idempotency records for tenant (for debugging)
   */
  async getRecordsByTenant(tenantId: string): Promise<IdempotencyRegistryRecord[]> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .gt('expires_at', now.toISOString())
      .order('processed_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get tenant records: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Get Records by Correlation ID
   * 
   * Find all intents with same correlation ID (for tracing)
   */
  async getRecordsByCorrelation(correlationId: string): Promise<IdempotencyRegistryRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('processed_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get correlation records: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Cleanup Expired Records
   * 
   * Remove expired records (garbage collection)
   * 
   * @returns Number of records deleted
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    
    const { count, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .delete({ count: 'exact' })
      .lt('expires_at', now.toISOString());
    
    if (error) {
      throw new Error(`Failed to cleanup expired records: ${error.message}`);
    }
    
    return count || 0;
  }
  
  /**
   * Get Stats
   * 
   * Registry statistics (for monitoring)
   */
  async getStats(): Promise<{
    totalRecords: number;
    recordsByTenant: Map<string, number>;
  }> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('runtime_idempotency_registry')
      .select('tenant_id')
      .gt('expires_at', now.toISOString());
    
    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
    
    const recordsByTenant = new Map<string, number>();
    for (const record of data || []) {
      const count = recordsByTenant.get(record.tenant_id) || 0;
      recordsByTenant.set(record.tenant_id, count + 1);
    }
    
    return {
      totalRecords: data?.length || 0,
      recordsByTenant,
    };
  }
  
  /**
   * Map database row to record
   */
  private mapToRecord(data: any): IdempotencyRegistryRecord {
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      idempotency_key: data.idempotency_key,
      correlation_id: data.correlation_id,
      intent_type: data.intent_type,
      outbox_id: data.outbox_id,
      processed_at: new Date(data.processed_at),
      expires_at: new Date(data.expires_at),
    };
  }
}
