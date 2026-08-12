/**
 * Common Core — Generalized Idempotency Primitives
 * 
 * Domain-agnostic idempotency key structure and execution contracts.
 * 
 * @module platform/core/idempotency
 */

export interface IdempotencyKey {
  tenantId: string;
  operation: string;    // e.g., 'CREATE_ORDER', 'APPROVE_PRESCRIPTION', 'ENROLL_STUDENT'
  businessKey: string;  // e.g., requestId, clinicalOrderId, enrollmentRequestId
}

export interface IdempotentResult<T = unknown> {
  isDuplicate: boolean;
  data: T;
  executedAt: string;
}

export interface IdempotencyStore {
  get<T = unknown>(key: IdempotencyKey): Promise<IdempotentResult<T> | null>;
  set<T = unknown>(key: IdempotencyKey, data: T): Promise<void>;
  clear(): void;
}
