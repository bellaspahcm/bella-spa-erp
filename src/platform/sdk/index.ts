/**
 * @fileoverview Platform SDK — Base Abstractions & Contracts
 *
 * Provides base classes and interfaces for all vertical kernels.
 * Vertical implementations inherit from these SDKs to reduce boilerplate
 * and enforce platform-level contracts (RLS, optimistic locking, auditing).
 *
 * @module platform/sdk
 */

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN SDK — Base Domain Model with Auditing & Optimistic Locking
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base domain model all platform aggregates must extend.
 * Enforces optimistic locking (version), soft-delete (deleted_at),
 * and full audit trail (created_by, updated_by).
 */
export abstract class BaseDomainModel {
  abstract readonly id: string;
  abstract readonly tenantId: string;
  /** Optimistic locking counter. Must be incremented on every save. */
  abstract readonly version: number;
  abstract readonly createdAt: Date;
  abstract readonly updatedAt: Date;
  readonly deletedAt?: Date;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY SDK — Typed CRUD with RLS + Optimistic Locking
// ═══════════════════════════════════════════════════════════════════════════

export interface FindOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly includeDeleted?: boolean;
}

export interface OptimisticLockError {
  readonly kind: 'OPTIMISTIC_LOCK_ERROR';
  readonly entityId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
}

export type SaveResult<T> =
  | { readonly success: true; readonly entity: T }
  | { readonly success: false; readonly error: OptimisticLockError | string };

/**
 * Base repository interface all data-access layers must implement.
 * Includes optimistic locking on save to prevent lost updates.
 */
export interface RepositorySDK<T extends BaseDomainModel> {
  findById(id: string, tenantId: string): Promise<T | null>;
  findMany(tenantId: string, options?: FindOptions): Promise<T[]>;
  /** Must check entity.version against DB before saving. */
  save(entity: T, actorId?: string): Promise<SaveResult<T>>;
  softDelete(id: string, tenantId: string, actorId?: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT SDK — Domain Event Publishing
// ═══════════════════════════════════════════════════════════════════════════

export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly schemaVersion: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
  readonly actorId?: string;
}

export interface EventSDK {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  publishMany<TPayload>(events: DomainEvent<TPayload>[]): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND SDK — Application-level Commands
// ═══════════════════════════════════════════════════════════════════════════

export interface Command<TPayload = Record<string, unknown>> {
  readonly commandType: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly issuedBy: string;
  readonly issuedAt: Date;
  readonly payload: TPayload;
}

export type CommandResult<TResult = void> =
  | { readonly success: true; readonly result: TResult }
  | { readonly success: false; readonly error: string; readonly code?: string };

export interface CommandSDK<TCommand extends Command, TResult = void> {
  execute(command: TCommand): Promise<CommandResult<TResult>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SDK — Domain Invariant Validation
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: ValidationError[] };

export interface ValidationSDK<T> {
  validate(value: T): ValidationResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTION SDK — Read Model (CQRS Read Side)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectionSDK<TEvent, TReadModel> {
  project(event: TEvent): Promise<void>;
  rebuild(tenantId: string): Promise<TReadModel>;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY SDK — Read-only Data Fetching
// ═══════════════════════════════════════════════════════════════════════════

export interface QuerySDK<TQuery, TResult> {
  execute(query: TQuery): Promise<TResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Common utility types
// ═══════════════════════════════════════════════════════════════════════════

export type PaginatedResult<T> = {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
};

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
