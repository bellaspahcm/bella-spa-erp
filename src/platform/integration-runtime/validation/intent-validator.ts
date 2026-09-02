/**
 * Financial Intent Validator
 * 
 * Runtime validation enforcement:
 * - Schema validation (Zod)
 * - Prohibited fields (Finance Protection)
 * - Tenant validation
 * - Correlation ID presence
 * 
 * CRITICAL: This is RUNTIME enforcement, not just TypeScript compile-time
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { z } from 'zod';
import {
  FinancialIntent,
  FinancialIntentSchema,
  PROHIBITED_FIELDS,
} from '../types/financial-intent.types';
import {
  ValidationError,
  FinanceProtectionError,
  TenantIsolationError,
  buildErrorContext,
} from '../types/runtime-errors.types';

/**
 * Validation Result
 * 
 * Result of intent validation
 */
export interface ValidationResult {
  valid: boolean;
  intent?: FinancialIntent;
  errors: string[];
}

/**
 * Intent Validator
 * 
 * Validates Financial Intent at Runtime boundary
 */
export class IntentValidator {
  /**
   * Validate Financial Intent
   * 
   * @throws ValidationError if validation fails
   * @throws FinanceProtectionError if prohibited field detected
   * @throws TenantIsolationError if tenant invalid
   */
  public validate(intent: unknown): FinancialIntent {
    // Step 1: Type check
    if (typeof intent !== 'object' || intent === null) {
      throw new ValidationError(
        'Invalid intent: Must be an object',
        buildErrorContext(undefined, undefined, { received: typeof intent })
      );
    }
    
    // Step 2: Finance Protection (prohibited fields)
    this.validateNoProhibitedFields(intent);
    
    // Step 3: Schema validation (Zod strict mode)
    const parseResult = FinancialIntentSchema.safeParse(intent);
    if (!parseResult.success) {
      const errors = parseResult.error?.issues || [];
      
      // Build error message (include field names from path or message)
      const errorMessages = errors.map((e) => {
        const path = e.path.length > 0 ? e.path.map(String).join('.') : '';
        // For strict mode, Zod includes field name in message
        const message = e.message || 'Validation failed';
        return path ? `${path}: ${message}` : message;
      });
      
      const fullMessage = errorMessages.length > 0
        ? errorMessages.join('; ')
        : 'Schema validation failed';
      
      throw new ValidationError(
        `Schema validation failed: ${fullMessage}`,
        buildErrorContext(
          intent as Partial<FinancialIntent>,
          undefined,
          { zodErrors: errors }
        )
      );
    }
    
    const validatedIntent = parseResult.data as FinancialIntent;
    
    // Step 4: Tenant validation
    this.validateTenant(validatedIntent.tenantId);
    
    // Step 5: Correlation ID validation
    this.validateCorrelationId(validatedIntent.correlationId);
    
    // Step 6: Amount validation
    this.validateAmount(validatedIntent.amount);
    
    // Step 7: Currency validation (ISO 4217)
    this.validateCurrency(validatedIntent.currency);
    
    return validatedIntent;
  }
  
  /**
   * Validate No Prohibited Fields (Finance Protection)
   * 
   * RUNTIME enforcement: Reject intents with accounting authority fields
   * RECURSIVE: Scans nested objects and arrays
   * 
   * @throws FinanceProtectionError if prohibited field present
   */
  private validateNoProhibitedFields(intent: unknown, path: string = ''): void {
    if (typeof intent !== 'object' || intent === null) {
      return;
    }
    
    // Scan current level
    for (const field of PROHIBITED_FIELDS) {
      if (field in intent) {
        const fullPath = path ? `${path}.${field}` : field;
        throw new FinanceProtectionError(
          fullPath,
          buildErrorContext(
            intent as Partial<FinancialIntent>,
            undefined,
            { attemptedField: fullPath, path }
          )
        );
      }
    }
    
    // Recursively scan nested objects and arrays
    for (const [key, value] of Object.entries(intent)) {
      if (value !== null && typeof value === 'object') {
        const newPath = path ? `${path}.${key}` : key;
        
        if (Array.isArray(value)) {
          // Scan array elements
          value.forEach((item, index) => {
            if (item !== null && typeof item === 'object') {
              this.validateNoProhibitedFields(item, `${newPath}[${index}]`);
            }
          });
        } else {
          // Scan nested object
          this.validateNoProhibitedFields(value, newPath);
        }
      }
    }
  }
  
  /**
   * Validate Tenant ID
   * 
   * @throws TenantIsolationError if tenant invalid
   */
  private validateTenant(tenantId: string): void {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new TenantIsolationError(
        tenantId,
        'Tenant ID is required and cannot be empty',
        buildErrorContext(undefined, undefined, { tenantId })
      );
    }
    
    // Additional tenant validation can be added here:
    // - Check tenant exists in registry
    // - Check tenant is active
    // - Check tenant has Finance OS access
  }
  
  /**
   * Validate Correlation ID
   * 
   * @throws ValidationError if correlation ID invalid
   */
  private validateCorrelationId(correlationId: string): void {
    if (!correlationId || correlationId.trim().length === 0) {
      throw new ValidationError(
        'Correlation ID is required and cannot be empty',
        buildErrorContext(undefined, undefined, { correlationId })
      );
    }
  }
  
  /**
   * Validate Amount
   * 
   * @throws ValidationError if amount invalid
   */
  private validateAmount(amount: number): void {
    if (!Number.isFinite(amount)) {
      throw new ValidationError(
        `Invalid amount: Must be a finite number (received: ${amount})`,
        buildErrorContext(undefined, undefined, { amount })
      );
    }
    
    if (amount < 0) {
      throw new ValidationError(
        `Invalid amount: Must be non-negative (received: ${amount})`,
        buildErrorContext(undefined, undefined, { amount })
      );
    }
  }
  
  /**
   * Validate Currency (ISO 4217)
   * 
   * @throws ValidationError if currency invalid
   */
  private validateCurrency(currency: string): void {
    if (!currency || currency.length !== 3) {
      throw new ValidationError(
        `Invalid currency: Must be 3-letter ISO 4217 code (received: ${currency})`,
        buildErrorContext(undefined, undefined, { currency })
      );
    }
    
    // ISO 4217 currencies are uppercase
    if (currency !== currency.toUpperCase()) {
      throw new ValidationError(
        `Invalid currency: Must be uppercase (received: ${currency})`,
        buildErrorContext(undefined, undefined, { currency })
      );
    }
  }
  
  /**
   * Validate Batch
   * 
   * Validate multiple intents (for bulk operations)
   * Returns partial results (valid intents + errors)
   */
  public validateBatch(intents: unknown[]): {
    valid: FinancialIntent[];
    errors: Array<{ index: number; error: Error }>;
  } {
    const valid: FinancialIntent[] = [];
    const errors: Array<{ index: number; error: Error }> = [];
    
    for (let i = 0; i < intents.length; i++) {
      try {
        const validated = this.validate(intents[i]);
        valid.push(validated);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    
    return { valid, errors };
  }
}

/**
 * Default validator instance
 * 
 * Singleton for common usage
 */
export const intentValidator = new IntentValidator();
