/**
 * Common Core — Generalized Idempotent Execution Handler
 * 
 * Intercepts duplicate operations using the multi-domain IdempotencyKey format:
 * tenantId + operation + businessKey
 * 
 * @module platform/core/idempotency/idempotent-execution.handler
 */

import { IdempotencyKey, IdempotencyStore, IdempotentResult } from './types';

export class MemoryIdempotencyStore implements IdempotencyStore {
  private cache = new Map<string, IdempotentResult<unknown>>();

  private formatKey(key: IdempotencyKey): string {
    return `${key.tenantId}:${key.operation}:${key.businessKey}`;
  }

  public async get<T = unknown>(key: IdempotencyKey): Promise<IdempotentResult<T> | null> {
    const k = this.formatKey(key);
    const result = this.cache.get(k);
    return result ? (result as IdempotentResult<T>) : null;
  }

  public async set<T = unknown>(key: IdempotencyKey, data: T): Promise<void> {
    const k = this.formatKey(key);
    this.cache.set(k, {
      isDuplicate: true,
      data,
      executedAt: new Date().toISOString(),
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export class IdempotentExecutionHandler {
  constructor(private store: IdempotencyStore = new MemoryIdempotencyStore()) {}

  public async execute<T>(
    key: IdempotencyKey,
    operationFn: () => Promise<T>
  ): Promise<{ data: T; isDuplicate: boolean }> {
    const existing = await this.store.get<T>(key);
    if (existing) {
      console.log(`[Idempotency] Duplicate request intercepted for ${key.operation}:${key.businessKey}`);
      return { data: existing.data, isDuplicate: true };
    }

    const result = await operationFn();
    await this.store.set(key, result);
    return { data: result, isDuplicate: false };
  }
}
