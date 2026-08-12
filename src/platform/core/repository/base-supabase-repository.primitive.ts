/**
 * Common Core — Lightweight Base Supabase Repository Primitive
 * 
 * Provides tenant scoping and DB error mapping primitives.
 * Contains ZERO business logic.
 * 
 * @module platform/core/repository/base-supabase-repository.primitive
 */

import { ExceptionMapper } from '../errors/exception-mapper';
import { PlatformError } from '../errors/types';

export abstract class BaseSupabaseRepositoryPrimitive {
  /**
   * Helper to throw OptimisticLockError if UPDATE row count is 0
   */
  protected checkOptimisticLock(affectedRows: number, expectedVersion?: number, entityId?: string): void {
    ExceptionMapper.checkOptimisticLock(affectedRows, expectedVersion, entityId);
  }

  /**
   * Helper to normalize database exceptions using ExceptionMapper
   */
  protected mapDatabaseError(error: unknown, contextMessage?: string): PlatformError {
    return ExceptionMapper.mapDatabaseError(error, contextMessage);
  }
}
