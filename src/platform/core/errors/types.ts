/**
 * Common Core — Error & Exception Primitives
 * 
 * Domain-agnostic exception classes and error normalization contracts.
 * 
 * @module platform/core/errors
 */

export class PlatformError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string = 'PLATFORM_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UniqueConstraintViolationError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'UNIQUE_CONSTRAINT_VIOLATION', details);
  }
}

export class ForeignKeyViolationError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FOREIGN_KEY_VIOLATION', details);
  }
}

export class OptimisticLockError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'OPTIMISTIC_LOCK_ERROR', details);
  }
}

export class EntityNotFoundError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ENTITY_NOT_FOUND', details);
  }
}

export class TenantIsolationError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TENANT_ISOLATION_ERROR', details);
  }
}
