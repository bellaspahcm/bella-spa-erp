/**
 * Idempotency Manager
 * 
 * High-level idempotency orchestration
 * Coordinates key derivation, registry checks, and duplicate handling
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { FinancialIntent } from '../types/financial-intent.types';
import { IdempotencyError, buildErrorContext } from '../types/runtime-errors.types';
import { IdempotencyKeyComponents } from '../types/runtime-config.types';
import { deriveIdempotencyKey, createIdempotencyKey, IdempotencyKeyMetadata } from './idempotency-key';
import { IdempotencyRegistry, IdempotencyRecord } from './idempotency-registry';

/**
 * Idempotency Check Result
 * 
 * Result of idempotency check
 */
export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  keyMetadata: IdempotencyKeyMetadata;
  existingRecord?: IdempotencyRecord;
}

/**
 * Idempotency Manager
 * 
 * Orchestrates idempotency checking and registration
 */
export class IdempotencyManager {
  constructor(
    private registry: IdempotencyRegistry,
    private algorithm: 'sha256' | 'sha512' = 'sha256'
  ) {}
  
  /**
   * Check Intent Idempotency
   * 
   * Check if intent is duplicate
   * 
   * @param intent - Financial intent to check
   * @returns Check result (duplicate status + metadata)
   */
  public checkIntent(intent: FinancialIntent): IdempotencyCheckResult {
    // Derive idempotency key
    const keyMetadata = this.deriveKeyFromIntent(intent);
    
    // Check registry
    const existingRecord = this.registry.check(keyMetadata);
    
    return {
      isDuplicate: existingRecord !== undefined,
      keyMetadata,
      existingRecord,
    };
  }
  
  /**
   * Register Intent
   * 
   * Register successfully processed intent
   * 
   * @param intent - Financial intent
   * @param outboxId - Outbox record ID
   */
  public registerIntent(intent: FinancialIntent, outboxId: string): void {
    const keyMetadata = this.deriveKeyFromIntent(intent);
    this.registry.register(keyMetadata, outboxId);
  }
  
  /**
   * Check and Register (Atomic)
   * 
   * Check idempotency and register if new
   * 
   * @param intent - Financial intent
   * @param outboxId - Outbox record ID
   * @returns Check result
   * 
   * @throws IdempotencyError if duplicate detected
   */
  public checkAndRegister(
    intent: FinancialIntent,
    outboxId: string
  ): IdempotencyCheckResult {
    const keyMetadata = this.deriveKeyFromIntent(intent);
    const existingRecord = this.registry.checkAndRegister(keyMetadata, outboxId);
    
    if (existingRecord) {
      // Duplicate detected
      throw new IdempotencyError(
        keyMetadata.key,
        existingRecord.outboxId,
        buildErrorContext(intent, undefined, {
          keyMetadata,
          existingRecord,
        })
      );
    }
    
    return {
      isDuplicate: false,
      keyMetadata,
    };
  }
  
  /**
   * Derive Key from Intent
   * 
   * Extract components and derive idempotency key
   */
  private deriveKeyFromIntent(intent: FinancialIntent): IdempotencyKeyMetadata {
    const components: IdempotencyKeyComponents = {
      tenantId: intent.tenantId,
      correlationId: intent.correlationId,
      intentType: intent.intentType,
    };
    
    return createIdempotencyKey(components, this.algorithm);
  }
  
  /**
   * Get Intent Status
   * 
   * Check if intent was processed (non-throwing)
   * 
   * @returns Processing status
   */
  public getIntentStatus(intent: FinancialIntent): {
    processed: boolean;
    record?: IdempotencyRecord;
  } {
    const keyMetadata = this.deriveKeyFromIntent(intent);
    const record = this.registry.getRecord(keyMetadata.key);
    
    return {
      processed: record !== undefined,
      record,
    };
  }
  
  /**
   * List Processed Intents (by Tenant)
   * 
   * Get all processed intents for tenant (for debugging)
   */
  public listProcessedIntents(tenantId: string): IdempotencyRecord[] {
    return this.registry.getRecordsByTenant(tenantId);
  }
  
  /**
   * Get Stats
   * 
   * Registry statistics
   */
  public getStats() {
    return this.registry.getStats();
  }
}

/**
 * Default idempotency manager instance
 * 
 * Singleton for common usage
 */
export const idempotencyManager = new IdempotencyManager(
  new IdempotencyRegistry()
);
