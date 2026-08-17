/**
 * N1 Failure Isolation — Finance Outbox Writer
 * 
 * Durable, async event delivery for Hospital → Finance integration
 * 
 * Responsibilities:
 * - Write finance events to outbox (same transaction as Hospital business data)
 * - Generate event envelope (reuse FinanceEventPublisher logic)
 * - Do NOT directly POST to Finance OS (async worker handles that)
 * 
 * Boundary:
 * - Integration/Resilience layer (NOT Kernel)
 * - Hospital business transaction INDEPENDENT of Finance availability
 * 
 * @see docs/testing/H1_1_E2E_TEST_RESULTS.md (N1 Gate)
 */

import { v4 as uuidv4 } from 'uuid';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import {
  FinanceEventEnvelope,
  BusinessContext,
  BusinessReference,
} from './finance-event-contract.types';

/**
 * Finance Outbox Writer Configuration
 */
export interface FinanceOutboxWriterConfig {
  /** Source system identifier (e.g., "HOSPITAL_OS") */
  sourceSystem: string;
  
  /** Source system version */
  sourceVersion: string;
  
  /** Max retry attempts (default: 5) */
  maxRetries?: number;
}

/**
 * Parameters for writing finance event to outbox
 */
export interface WriteFinanceEventToOutboxParams {
  /** Event type (e.g., "PATIENT_SERVICE_COMPLETED") */
  eventType: string;
  
  /** Tenant ID (REQUIRED - P0 Gate) */
  tenantId: string;
  
  /** Amount (decimal as string) */
  amount: string;
  
  /** ISO 4217 currency code */
  currency: string;
  
  /** Business context (domain-specific) */
  businessContext: BusinessContext;
  
  /** Business references */
  businessReferences: BusinessReference[];
  
  /** Optional: Event ID (auto-generated if not provided) */
  eventId?: string;
  
  /** Optional: Idempotency key (auto-generated if not provided) */
  idempotencyKey?: string;
  
  /** Optional: When event occurred (ISO 8601, defaults to now) */
  occurredAt?: string;
  
  /** Optional: Organizational unit */
  orgUnitId?: string;
  
  /** Optional: Correlation ID (auto-generated if not provided) */
  correlationId?: string;
  
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of outbox write operation
 */
export interface FinanceOutboxWriteResult {
  /** Outbox record ID */
  outboxId: string;
  
  /** Event ID */
  eventId: string;
  
  /** Idempotency key */
  idempotencyKey: string;
}

/**
 * Finance Outbox Writer
 * 
 * Writes finance events to durable outbox instead of synchronous HTTP POST
 * 
 * Usage:
 * ```typescript
 * const writer = new FinanceOutboxWriter(supabase, {
 *   sourceSystem: 'HOSPITAL_OS',
 *   sourceVersion: '1.0.0'
 * });
 * 
 * // Within Hospital business transaction
 * const result = await writer.writeToOutbox({
 *   eventType: 'PATIENT_SERVICE_COMPLETED',
 *   tenantId: 'tenant_a',
 *   amount: '500000',
 *   currency: 'VND',
 *   businessContext: {...},
 *   businessReferences: [...]
 * });
 * 
 * // Hospital returns 200/201 immediately
 * // Async worker processes outbox → Finance OS later
 * ```
 */
export class FinanceOutboxWriter {
  constructor(
    private supabase: SupabaseClient<Database>,
    private config: FinanceOutboxWriterConfig
  ) {
    this.config = {
      ...config,
      maxRetries: config.maxRetries || 5,
    };
  }
  
  /**
   * Write finance event to outbox
   * 
   * CRITICAL: This must be called within the same database transaction
   * as the Hospital business operation to ensure atomic commit.
   * 
   * @param params Event parameters
   * @returns Outbox write result
   */
  async writeToOutbox(params: WriteFinanceEventToOutboxParams): Promise<FinanceOutboxWriteResult> {
    // Validate parameters
    this.validate(params);
    
    // Generate event envelope (same logic as FinanceEventPublisher)
    const envelope = this.createEnvelope(params);
    
    // Insert to finance_outbox_events (PENDING status)
    const { data, error } = await this.supabase
      .from('finance_outbox_events')
      .insert({
        tenant_id: params.tenantId,
        event_type: params.eventType,
        event_id: envelope.event_id,
        payload: envelope as any, // JSONB
        status: 'PENDING',
        retry_count: 0,
        max_retries: this.config.maxRetries,
        next_retry_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (error) {
      throw new FinanceOutboxWriteException(
        `Failed to write event to outbox: ${error.message}`,
        envelope,
        error
      );
    }
    
    return {
      outboxId: data.id,
      eventId: envelope.event_id,
      idempotencyKey: envelope.idempotency_key,
    };
  }
  
  /**
   * Create event envelope
   * 
   * Same logic as FinanceEventPublisher.createEnvelope()
   */
  private createEnvelope(params: WriteFinanceEventToOutboxParams): FinanceEventEnvelope {
    const now = new Date().toISOString();
    
    return {
      // Event identity
      event_id: params.eventId || uuidv4(),
      event_type: params.eventType,
      idempotency_key: params.idempotencyKey || this.generateIdempotencyKey(params),
      
      // Temporal context
      occurred_at: params.occurredAt || now,
      created_at: now,
      
      // Tenant context
      tenant_id: params.tenantId,
      org_unit_id: params.orgUnitId,
      
      // Source context
      source_system: this.config.sourceSystem,
      source_version: this.config.sourceVersion,
      correlation_id: params.correlationId || uuidv4(),
      
      // Financial context
      amount: params.amount,
      currency: params.currency,
      
      // Business context
      business_context: params.businessContext,
      
      // References
      business_references: params.businessReferences,
      
      // Metadata
      metadata: params.metadata,
    };
  }
  
  /**
   * Validate event parameters
   */
  private validate(params: WriteFinanceEventToOutboxParams): void {
    const errors: string[] = [];
    
    if (!params.eventType) errors.push('eventType is required');
    if (!params.tenantId) errors.push('tenantId is required (P0 Gate)');
    if (!params.amount) errors.push('amount is required');
    if (!params.currency) errors.push('currency is required');
    if (!params.businessContext) errors.push('businessContext is required');
    if (!params.businessReferences || params.businessReferences.length === 0) {
      errors.push('at least one businessReference is required');
    }
    
    // Amount validation
    if (params.amount) {
      const amountNum = parseFloat(params.amount);
      if (isNaN(amountNum)) errors.push('amount must be a valid number');
      if (amountNum < 0) errors.push('amount must be non-negative');
    }
    
    // Currency validation (ISO 4217)
    if (params.currency && params.currency.length !== 3) {
      errors.push('currency must be 3-letter ISO 4217 code');
    }
    
    if (errors.length > 0) {
      throw new FinanceOutboxValidationException(errors);
    }
  }
  
  /**
   * Generate idempotency key
   * 
   * Default strategy: tenant_id + event_type + primary business reference
   */
  private generateIdempotencyKey(params: WriteFinanceEventToOutboxParams): string {
    const primaryRef = params.businessReferences[0];
    return `${params.tenantId}_${params.eventType}_${primaryRef.entity_type}_${primaryRef.entity_id}`;
  }
}

/**
 * Finance Outbox Validation Exception
 */
export class FinanceOutboxValidationException extends Error {
  constructor(public errors: string[]) {
    super(`Finance outbox validation failed: ${errors.join(', ')}`);
    this.name = 'FinanceOutboxValidationException';
  }
}

/**
 * Finance Outbox Write Exception
 */
export class FinanceOutboxWriteException extends Error {
  constructor(
    message: string,
    public envelope: FinanceEventEnvelope,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FinanceOutboxWriteException';
  }
}
