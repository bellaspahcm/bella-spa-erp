/**
 * F5.6 C7-H1 Finance OS — Idempotency Store Implementation
 * 
 * Stores idempotency keys to prevent duplicate transaction processing
 * 
 * Architecture Boundary:
 * - Input: Idempotency entry (key, event ID, transaction ID)
 * - Output: Stored entry or null
 * 
 * Critical for H-C7-T3: Idempotency Test
 * - Same idempotency_key → Same transaction ID
 * - Prevents duplicate financial entries
 * 
 * Current Implementation: In-memory store (for H1 E2E testing)
 * Production Implementation: Database-backed store
 */

import type { IdempotencyStore } from '../finance-event-handler';
import type { IdempotencyEntry } from '../../integration-hub/finance-event-contract.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * In-Memory Idempotency Store
 * 
 * Simple in-memory implementation for H1 E2E testing
 * 
 * WARNING: NOT production-ready
 * - Data lost on server restart
 * - No persistence
 * - No expiration
 * 
 * Use DatabaseIdempotencyStore for production
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private entries: Map<string, IdempotencyEntry> = new Map();
  
  /**
   * Get idempotency entry by key
   */
  async get(key: string): Promise<IdempotencyEntry | null> {
    const entry = this.entries.get(key);
    return entry || null;
  }
  
  /**
   * Store idempotency entry
   */
  async store(entry: IdempotencyEntry): Promise<void> {
    this.entries.set(entry.idempotency_key, entry);
  }
  
  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
  }
  
  /**
   * Get store size (for testing)
   */
  size(): number {
    return this.entries.size;
  }
}

/**
 * Database Idempotency Store
 * 
 * Production-ready implementation backed by Supabase
 * 
 * Schema:
 * ```sql
 * CREATE TABLE finance_event_idempotency (
 *   idempotency_key VARCHAR(255) PRIMARY KEY,
 *   event_id VARCHAR(255) NOT NULL,
 *   transaction_id VARCHAR(255) NOT NULL,
 *   status VARCHAR(50) NOT NULL,
 *   created_at TIMESTAMP NOT NULL,
 *   updated_at TIMESTAMP NOT NULL,
 *   tenant_id VARCHAR(255) NOT NULL
 * );
 * ```
 */
export class DatabaseIdempotencyStore implements IdempotencyStore {
  constructor(private supabase: SupabaseClient<Database>) {}
  
  /**
   * Get idempotency entry by key
   */
  async get(key: string): Promise<IdempotencyEntry | null> {
    const { data, error } = await this.supabase
      .from('finance_event_idempotency')
      .select('*')
      .eq('idempotency_key', key)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      idempotency_key: data.idempotency_key,
      event_id: data.event_id,
      transaction_id: data.transaction_id,
      status: data.status as 'COMPLETED' | 'PROCESSING' | 'FAILED',
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenant_id: data.tenant_id,
    };
  }
  
  /**
   * Store idempotency entry
   */
  async store(entry: IdempotencyEntry): Promise<void> {
    const { error } = await this.supabase
      .from('finance_event_idempotency')
      .insert({
        idempotency_key: entry.idempotency_key,
        event_id: entry.event_id,
        transaction_id: entry.transaction_id,
        status: entry.status,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        tenant_id: entry.tenant_id,
      });
    
    if (error) {
      throw new IdempotencyStoreError(
        `Failed to store idempotency entry: ${error.message}`,
        entry.idempotency_key
      );
    }
  }
}

/**
 * Idempotency Store Error
 */
export class IdempotencyStoreError extends Error {
  constructor(
    message: string,
    public readonly idempotencyKey: string
  ) {
    super(message);
    this.name = 'IdempotencyStoreError';
  }
}
