/**
 * Common Core — Database Exception Mapper
 * 
 * Maps Postgres/Supabase database errors to domain-agnostic PlatformError instances.
 * 
 * @module platform/core/errors/exception-mapper
 */

import {
  ForeignKeyViolationError,
  OptimisticLockError,
  PlatformError,
  UniqueConstraintViolationError,
} from './types';

export class ExceptionMapper {
  public static mapDatabaseError(error: unknown, contextMessage?: string): PlatformError {
    if (!error) {
      return new PlatformError(contextMessage || 'Unknown database error', 'UNKNOWN_DB_ERROR');
    }

    const err = error as Record<string, unknown>;
    const code = String(err.code || err.statusCode || '');
    const message = String(err.message || error);
    const prefix = contextMessage ? `${contextMessage}: ` : '';

    // Postgres 23505: Unique constraint violation
    if (code === '23505') {
      return new UniqueConstraintViolationError(`${prefix}Duplicate key violation (${message})`, { rawError: error });
    }

    // Postgres 23503: Foreign key violation
    if (code === '23503') {
      return new ForeignKeyViolationError(`${prefix}Foreign key constraint violation (${message})`, { rawError: error });
    }

    return new PlatformError(`${prefix}${message}`, code || 'DATABASE_ERROR', { rawError: error });
  }

  public static checkOptimisticLock(affectedRows: number, expectedVersion?: number, entityId?: string): void {
    if (affectedRows === 0) {
      throw new OptimisticLockError(
        `Optimistic lock failed: version mismatch or record updated concurrently${entityId ? ` for ID ${entityId}` : ''}`,
        { expectedVersion, entityId }
      );
    }
  }
}
