/**
 * F5.6 C7-H1 Hospital Finance Integration — Finance Event Publisher
 * 
 * Used by Hospital OS (and other Vertical OS) to publish finance events
 * 
 * Responsibilities:
 * - Generate event envelope
 * - Validate event structure
 * - Publish to Finance OS
 * - Handle idempotency
 * - Implement failure isolation (queue + retry)
 * 
 * Does NOT:
 * - Resolve accounting semantic
 * - Generate debit/credit entries
 * - Apply accounting policy
 * 
 * @see docs/architecture/F5_6_C7_H1_HOSPITAL_FINANCE_INTEGRATION.md
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FinanceEventEnvelope,
  FinanceEventResult,
  FinanceEventValidationResult,
  FinanceEventValidationError,
  BusinessContext,
  BusinessReference,
} from './finance-event-contract.types';

/**
 * Finance Event Publisher Configuration
 */
export interface FinanceEventPublisherConfig {
  /** Finance OS endpoint URL */
  financeOsEndpoint: string;
  
  /** Source system identifier (e.g., "HOSPITAL_OS") */
  sourceSystem: string;
  
  /** Source system version */
  sourceVersion: string;
  
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
  
  /** Timeout (ms) */
  timeoutMs?: number;
}

/**
 * Finance Event Publisher
 * 
 * Used by Vertical OS to publish finance events
 * 
 * Example usage (Hospital OS):
 * ```typescript
 * const publisher = new FinanceEventPublisher({
 *   financeOsEndpoint: process.env.FINANCE_OS_URL,
 *   sourceSystem: 'HOSPITAL_OS',
 *   sourceVersion: '1.0.0'
 * });
 * 
 * const result = await publisher.publish({
 *   eventType: 'PATIENT_SERVICE_COMPLETED',
 *   tenantId: 'tenant_a',
 *   amount: '500000',
 *   currency: 'VND',
 *   businessContext: {
 *     patient: { patient_id: 'PAT-001', patient_type: 'OUTPATIENT' },
 *     encounter: { encounter_id: 'ENC-001', encounter_type: 'CONSULTATION' }
 *   },
 *   businessReferences: [
 *     { entity_type: 'encounter', entity_id: 'ENC-001' }
 *   ]
 * });
 * ```
 */
export class FinanceEventPublisher {
  private config: FinanceEventPublisherConfig;
  
  constructor(config: FinanceEventPublisherConfig) {
    this.config = {
      ...config,
      retry: config.retry || { maxAttempts: 3, backoffMs: 1000 },
      timeoutMs: config.timeoutMs || 30000,
    };
  }
  
  /**
   * Publish finance event
   * 
   * @param params Event parameters
   * @returns Finance event result
   */
  async publish(params: PublishFinanceEventParams): Promise<FinanceEventResult> {
    // Validate parameters
    const validation = this.validate(params);
    if (!validation.valid) {
      throw new FinanceEventValidationException(validation.errors);
    }
    
    // Generate event envelope
    const envelope = this.createEnvelope(params);
    
    // Publish with retry
    return this.publishWithRetry(envelope);
  }
  
  /**
   * Create event envelope
   */
  private createEnvelope(params: PublishFinanceEventParams): FinanceEventEnvelope {
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
  private validate(params: PublishFinanceEventParams): FinanceEventValidationResult {
    const errors: FinanceEventValidationError[] = [];
    
    // Required fields
    if (!params.eventType) {
      errors.push({
        field: 'eventType',
        message: 'Event type is required',
        code: 'REQUIRED',
      });
    }
    
    if (!params.tenantId) {
      errors.push({
        field: 'tenantId',
        message: 'Tenant ID is required (P0 Gate)',
        code: 'REQUIRED',
      });
    }
    
    if (!params.amount) {
      errors.push({
        field: 'amount',
        message: 'Amount is required',
        code: 'REQUIRED',
      });
    }
    
    if (!params.currency) {
      errors.push({
        field: 'currency',
        message: 'Currency is required',
        code: 'REQUIRED',
      });
    }
    
    if (!params.businessContext) {
      errors.push({
        field: 'businessContext',
        message: 'Business context is required',
        code: 'REQUIRED',
      });
    }
    
    if (!params.businessReferences || params.businessReferences.length === 0) {
      errors.push({
        field: 'businessReferences',
        message: 'At least one business reference is required',
        code: 'REQUIRED',
      });
    }
    
    // Amount validation
    if (params.amount) {
      const amountNum = parseFloat(params.amount);
      if (isNaN(amountNum)) {
        errors.push({
          field: 'amount',
          message: 'Amount must be a valid number',
          code: 'INVALID_FORMAT',
        });
      }
      if (amountNum < 0) {
        errors.push({
          field: 'amount',
          message: 'Amount must be non-negative',
          code: 'INVALID_VALUE',
        });
      }
    }
    
    // Currency validation (ISO 4217)
    if (params.currency && params.currency.length !== 3) {
      errors.push({
        field: 'currency',
        message: 'Currency must be 3-letter ISO 4217 code',
        code: 'INVALID_FORMAT',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Generate idempotency key
   * 
   * Default strategy: tenant_id + event_type + primary business reference
   */
  private generateIdempotencyKey(params: PublishFinanceEventParams): string {
    const primaryRef = params.businessReferences[0];
    return `${params.tenantId}_${params.eventType}_${primaryRef.entity_type}_${primaryRef.entity_id}`;
  }
  
  /**
   * Publish with retry (exponential backoff)
   */
  private async publishWithRetry(envelope: FinanceEventEnvelope): Promise<FinanceEventResult> {
    const { maxAttempts, backoffMs } = this.config.retry!;
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Attempt to publish
        return await this.sendToFinanceOS(envelope);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on validation errors
        if (error instanceof FinanceEventValidationException) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const waitMs = backoffMs * Math.pow(2, attempt - 1);
          await this.sleep(waitMs);
        }
      }
    }
    
    // All retries failed
    throw new FinanceEventPublishException(
      `Failed to publish event after ${maxAttempts} attempts: ${lastError?.message}`,
      envelope,
      lastError
    );
  }
  
  /**
   * Send event to Finance OS
   */
  private async sendToFinanceOS(envelope: FinanceEventEnvelope): Promise<FinanceEventResult> {
    // TODO: In production, this would call Finance OS HTTP API or message queue
    // For now, we'll simulate the call
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    
    try {
      const response = await fetch(`${this.config.financeOsEndpoint}/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': envelope.tenant_id,
          'X-Correlation-ID': envelope.correlation_id,
        },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`Finance OS returned ${response.status}: ${errorBody.message || response.statusText}`);
      }
      
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Publish Finance Event Parameters
 */
export interface PublishFinanceEventParams {
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
 * Finance Event Validation Exception
 */
export class FinanceEventValidationException extends Error {
  constructor(public errors: FinanceEventValidationError[]) {
    super(`Finance event validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'FinanceEventValidationException';
  }
}

/**
 * Finance Event Publish Exception
 */
export class FinanceEventPublishException extends Error {
  constructor(
    message: string,
    public envelope: FinanceEventEnvelope,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FinanceEventPublishException';
  }
}
