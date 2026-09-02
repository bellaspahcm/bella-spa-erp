/**
 * Runtime Error Types
 * 
 * Structured error model for Common Integration Runtime
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

/**
 * Runtime Error Code
 * 
 * Categorized error codes for failure handling
 */
export enum RuntimeErrorCode {
  // Validation errors (4xx - client error, not retryable)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INTENT = 'INVALID_INTENT',
  PROHIBITED_FIELD = 'PROHIBITED_FIELD',
  INVALID_TENANT = 'INVALID_TENANT',
  MISSING_CORRELATION_ID = 'MISSING_CORRELATION_ID',
  
  // Idempotency errors (not retryable, expected behavior)
  DUPLICATE_INTENT = 'DUPLICATE_INTENT',
  
  // Database errors (retryable)
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  OUTBOX_WRITE_FAILED = 'OUTBOX_WRITE_FAILED',
  
  // Network errors (retryable)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  
  // Finance OS errors (some retryable, some not)
  FINANCE_SERVICE_UNAVAILABLE = 'FINANCE_SERVICE_UNAVAILABLE',
  FINANCE_PROCESSING_FAILED = 'FINANCE_PROCESSING_FAILED',
  FINANCE_REJECTED = 'FINANCE_REJECTED',
  
  // Runtime internal errors (retryable)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  
  // Quarantine errors (not retryable without intervention)
  POISON_MESSAGE = 'POISON_MESSAGE',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
}

/**
 * Runtime Error
 * 
 * Base error class for all runtime errors
 */
export class RuntimeError extends Error {
  public readonly code: RuntimeErrorCode;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  
  constructor(
    code: RuntimeErrorCode,
    message: string,
    retryable: boolean,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 * 
 * Thrown when Financial Intent validation fails
 * NOT retryable (client error)
 */
export class ValidationError extends RuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(RuntimeErrorCode.VALIDATION_FAILED, message, false, context);
    this.name = 'ValidationError';
  }
}

/**
 * Finance Protection Error
 * 
 * Thrown when prohibited accounting field detected
 * NOT retryable (architectural violation)
 */
export class FinanceProtectionError extends RuntimeError {
  public readonly prohibitedField: string;
  
  constructor(prohibitedField: string, context?: Record<string, unknown>) {
    super(
      RuntimeErrorCode.PROHIBITED_FIELD,
      `Finance Protection violation: Prohibited field '${prohibitedField}' detected. ` +
      `Financial Intent must NOT contain accounting authority fields.`,
      false,
      { ...context, prohibitedField }
    );
    this.name = 'FinanceProtectionError';
    this.prohibitedField = prohibitedField;
  }
}

/**
 * Tenant Isolation Error
 * 
 * Thrown when tenant validation fails
 * NOT retryable (security violation)
 */
export class TenantIsolationError extends RuntimeError {
  public readonly tenantId: string;
  
  constructor(tenantId: string, message: string, context?: Record<string, unknown>) {
    super(
      RuntimeErrorCode.INVALID_TENANT,
      `Tenant isolation violation: ${message}`,
      false,
      { ...context, tenantId }
    );
    this.name = 'TenantIsolationError';
    this.tenantId = tenantId;
  }
}

/**
 * Idempotency Error
 * 
 * Thrown when duplicate intent detected
 * NOT retryable (expected behavior, not a failure)
 */
export class IdempotencyError extends RuntimeError {
  public readonly idempotencyKey: string;
  public readonly originalOutboxId: string;
  
  constructor(
    idempotencyKey: string,
    originalOutboxId: string,
    context?: Record<string, unknown>
  ) {
    super(
      RuntimeErrorCode.DUPLICATE_INTENT,
      `Duplicate intent detected (idempotency key: ${idempotencyKey}). ` +
      `Original intent: ${originalOutboxId}. No duplicate financial effect.`,
      false,
      { ...context, idempotencyKey, originalOutboxId }
    );
    this.name = 'IdempotencyError';
    this.idempotencyKey = idempotencyKey;
    this.originalOutboxId = originalOutboxId;
  }
}

/**
 * Outbox Error
 * 
 * Thrown when outbox write fails
 * Retryable (database error)
 */
export class OutboxError extends RuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(RuntimeErrorCode.OUTBOX_WRITE_FAILED, message, true, context);
    this.name = 'OutboxError';
  }
}

/**
 * Finance Service Error
 * 
 * Thrown when Finance OS communication fails
 * Retryable (network/service error)
 */
export class FinanceServiceError extends RuntimeError {
  public readonly statusCode?: number;
  
  constructor(
    message: string,
    retryable: boolean,
    statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(
      RuntimeErrorCode.FINANCE_SERVICE_UNAVAILABLE,
      message,
      retryable,
      { ...context, statusCode }
    );
    this.name = 'FinanceServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Quarantine Error
 * 
 * Thrown when intent requires quarantine
 * NOT retryable (requires manual intervention)
 */
export class QuarantineError extends RuntimeError {
  public readonly attempts: number;
  public readonly lastError: string;
  
  constructor(
    attempts: number,
    lastError: string,
    context?: Record<string, unknown>
  ) {
    super(
      RuntimeErrorCode.POISON_MESSAGE,
      `Intent quarantined after ${attempts} failed attempts. Last error: ${lastError}`,
      false,
      { ...context, attempts, lastError }
    );
    this.name = 'QuarantineError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Determine if error is retryable
 * 
 * Decision logic: Retryable errors vs permanent failures
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RuntimeError) {
    return error.retryable;
  }
  
  // Unknown errors: conservative approach (retry)
  // Better to retry unnecessarily than lose intent
  return true;
}

/**
 * Map error to RuntimeErrorCode
 * 
 * Classify unknown errors
 */
export function mapErrorToCode(error: unknown): RuntimeErrorCode {
  if (error instanceof RuntimeError) {
    return error.code;
  }
  
  if (error instanceof Error) {
    // Network/timeout errors
    if (error.message.includes('timeout')) {
      return RuntimeErrorCode.TIMEOUT;
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connection refused')) {
      return RuntimeErrorCode.CONNECTION_REFUSED;
    }
    if (error.message.includes('network') || error.message.includes('ENETUNREACH')) {
      return RuntimeErrorCode.NETWORK_ERROR;
    }
    
    // Database errors
    if (error.message.includes('database') || error.message.includes('transaction')) {
      return RuntimeErrorCode.DATABASE_ERROR;
    }
  }
  
  // Unknown error
  return RuntimeErrorCode.UNKNOWN_ERROR;
}

/**
 * Error Context
 * 
 * Standardized error context for observability
 */
export interface ErrorContext {
  tenantId?: string;
  correlationId?: string;
  intentType?: string;
  entityId?: string;
  attempts?: number;
  timestamp: Date;
  stack?: string;
  additionalContext?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties for compatibility with Record<string, unknown>
}

/**
 * Build error context from intent
 * 
 * Extract relevant fields for error reporting
 */
export function buildErrorContext(
  intent?: {
    tenantId?: string;
    correlationId?: string;
    intentType?: string;
    entityId?: string;
  },
  error?: Error,
  additionalContext?: Record<string, unknown>
): ErrorContext {
  return {
    tenantId: intent?.tenantId,
    correlationId: intent?.correlationId,
    intentType: intent?.intentType,
    entityId: intent?.entityId,
    timestamp: new Date(),
    stack: error?.stack,
    additionalContext,
  };
}
