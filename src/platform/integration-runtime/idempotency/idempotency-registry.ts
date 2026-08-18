/**
 * Idempotency Registry
 * 
 * In-memory idempotency key tracking
 * (Production: database-backed via runtime_idempotency_registry table)
 * 
 * Purpose: Detect duplicate intents, prevent duplicate financial effect
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { IdempotencyError, buildErrorContext } from '../types/runtime-errors.types';
import { IdempotencyKeyMetadata } from './idempotency-key';

/**
 * Idempotency Record
 * 
 * Stored record of processed intent
 */
export interface IdempotencyRecord {
  key: string;
  tenantId: string;
  correlationId: string;
  intentType: string;
  outboxId: string;
  processedAt: Date;
  expiresAt: Date;
}

/**
 * Idempotency Registry
 * 
 * Tracks processed intents to prevent duplicates
 */
export class IdempotencyRegistry {
  // In-memory store (production: database)
  private records: Map<string, IdempotencyRecord> = new Map();
  
  // TTL for records (24 hours default)
  private ttlMs: number;
  
  constructor(ttlMs: number = 86400000) {
    this.ttlMs = ttlMs;
    
    // Start cleanup timer (every 1 hour)
    this.startCleanupTimer();
  }
  
  /**
   * Check Idempotency
   * 
   * Check if intent already processed
   * 
   * @returns Existing record if duplicate, undefined otherwise
   * @throws IdempotencyError if duplicate detected (optional, can return instead)
   */
  public check(keyMetadata: IdempotencyKeyMetadata): IdempotencyRecord | undefined {
    const record = this.records.get(keyMetadata.key);
    
    if (!record) {
      return undefined;
    }
    
    // Check if expired
    if (record.expiresAt < new Date()) {
      // Expired, remove and allow replay
      this.records.delete(keyMetadata.key);
      return undefined;
    }
    
    // Duplicate detected
    return record;
  }
  
  /**
   * Register Intent
   * 
   * Register successfully processed intent
   * 
   * @param keyMetadata - Idempotency key metadata
   * @param outboxId - Outbox record ID
   */
  public register(
    keyMetadata: IdempotencyKeyMetadata,
    outboxId: string
  ): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    
    const record: IdempotencyRecord = {
      key: keyMetadata.key,
      tenantId: keyMetadata.tenantId,
      correlationId: keyMetadata.correlationId,
      intentType: keyMetadata.intentType,
      outboxId,
      processedAt: now,
      expiresAt,
    };
    
    this.records.set(keyMetadata.key, record);
  }
  
  /**
   * Check and Register (Atomic)
   * 
   * Check idempotency and register if new (single operation)
   * 
   * @returns Existing record if duplicate, undefined if new
   */
  public checkAndRegister(
    keyMetadata: IdempotencyKeyMetadata,
    outboxId: string
  ): IdempotencyRecord | undefined {
    const existing = this.check(keyMetadata);
    
    if (existing) {
      return existing;
    }
    
    this.register(keyMetadata, outboxId);
    return undefined;
  }
  
  /**
   * Get Record
   * 
   * Retrieve idempotency record by key
   */
  public getRecord(key: string): IdempotencyRecord | undefined {
    const record = this.records.get(key);
    
    if (!record) {
      return undefined;
    }
    
    // Check if expired
    if (record.expiresAt < new Date()) {
      this.records.delete(key);
      return undefined;
    }
    
    return record;
  }
  
  /**
   * Get Records by Tenant
   * 
   * List all records for tenant (for debugging/auditing)
   */
  public getRecordsByTenant(tenantId: string): IdempotencyRecord[] {
    const now = new Date();
    return Array.from(this.records.values())
      .filter(r => r.tenantId === tenantId && r.expiresAt > now);
  }
  
  /**
   * Cleanup Expired Records
   * 
   * Remove expired records (garbage collection)
   */
  public cleanup(): number {
    const now = new Date();
    let removed = 0;
    
    for (const [key, record] of this.records.entries()) {
      if (record.expiresAt < now) {
        this.records.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Start Cleanup Timer
   * 
   * Periodic cleanup (every 1 hour)
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`[IdempotencyRegistry] Cleaned up ${removed} expired records`);
      }
    }, 3600000); // 1 hour
  }
  
  /**
   * Clear Registry
   * 
   * Remove all records (for testing)
   */
  public clear(): void {
    this.records.clear();
  }
  
  /**
   * Get Stats
   * 
   * Registry statistics (for monitoring)
   */
  public getStats(): {
    totalRecords: number;
    recordsByTenant: Map<string, number>;
    oldestRecord?: Date;
    newestRecord?: Date;
  } {
    const now = new Date();
    const activeRecords = Array.from(this.records.values())
      .filter(r => r.expiresAt > now);
    
    const recordsByTenant = new Map<string, number>();
    let oldestRecord: Date | undefined;
    let newestRecord: Date | undefined;
    
    for (const record of activeRecords) {
      // Count by tenant
      const count = recordsByTenant.get(record.tenantId) || 0;
      recordsByTenant.set(record.tenantId, count + 1);
      
      // Track oldest/newest
      if (!oldestRecord || record.processedAt < oldestRecord) {
        oldestRecord = record.processedAt;
      }
      if (!newestRecord || record.processedAt > newestRecord) {
        newestRecord = record.processedAt;
      }
    }
    
    return {
      totalRecords: activeRecords.length,
      recordsByTenant,
      oldestRecord,
      newestRecord,
    };
  }
}

/**
 * Default idempotency registry instance
 * 
 * Singleton for common usage
 */
export const idempotencyRegistry = new IdempotencyRegistry();
