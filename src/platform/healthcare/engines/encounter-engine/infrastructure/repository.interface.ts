/**
 * Encounter Repository Interface
 * 
 * Constitution Compliance:
 * - Law 2: Repository provides abstraction over database (no direct DB access from product packs)
 * - Law 11: Strictly typed, no `any` types
 * 
 * Repository Pattern:
 * - Business rules stay in Encounter aggregate
 * - Repository only handles persistence operations
 * - No domain logic duplication
 * 
 * @module platform/healthcare/engines/encounter-engine/infrastructure
 */

import type { Encounter } from '../domain/encounter.entity';
import type { EncounterStatus, EncounterType } from '../domain/encounter.entity';

// ============================================================================
// Query Result Types
// ============================================================================

export interface EncounterSearchQuery {
  tenantId: string;
  patientId?: string;
  status?: EncounterStatus | EncounterStatus[];
  encounterType?: EncounterType;
  encounterClass?: string; // 'AMB', 'EMER', 'IMP', 'HH', 'VR'
  serviceProviderId?: string;
  departmentId?: string;
  locationId?: string;
  providerId?: string; // Alias for serviceProviderId
  fromDate?: string; // ISO date string
  toDate?: string; // ISO date string
  startDateFrom?: Date;
  startDateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface IEncounterRepository {
  /**
   * Save encounter (insert or update)
   * Repository determines if INSERT or UPDATE based on existence
   * Returns the saved encounter
   */
  save(encounter: Encounter): Promise<Encounter>;

  /**
   * Find encounter by ID
   * Returns null if not found or belongs to different tenant
   */
  findById(encounterId: string, tenantId: string): Promise<Encounter | null>;

  /**
   * Find encounters by patient
   * Ordered by period_start DESC (most recent first)
   */
  findByPatient(patientId: string, tenantId: string, limit?: number): Promise<Encounter[]>;

  /**
   * Search encounters with complex criteria
   * Supports pagination
   */
  search(query: EncounterSearchQuery): Promise<PaginatedResult<Encounter>>;

  /**
   * Find active encounters (arrived, triaged, in-progress, on-hold)
   * Used for "Current Patients" dashboard
   */
  findActive(tenantId: string, limit?: number): Promise<Encounter[]>;

  /**
   * Find encounters by service provider (doctor's patient list)
   */
  findByProvider(serviceProviderId: string, tenantId: string, limit?: number): Promise<Encounter[]>;

  /**
   * Find encounters by department (ward/unit patient list)
   */
  findByDepartment(departmentId: string, tenantId: string, limit?: number): Promise<Encounter[]>;

  /**
   * Check if encounter exists (for duplicate prevention)
   */
  exists(encounterId: string, tenantId: string): Promise<boolean>;

  /**
   * Delete encounter (soft delete)
   * Only allowed for planned/cancelled encounters (business rule check in aggregate)
   */
  delete(encounterId: string, tenantId: string): Promise<void>;

  /**
   * Count encounters by criteria (for statistics)
   */
  count(query: Partial<EncounterSearchQuery>): Promise<number>;

  /**
   * Begin transaction (for multi-aggregate operations)
   * Returns transaction context
   */
  beginTransaction(): Promise<RepositoryTransaction>;
}

// ============================================================================
// Transaction Support
// ============================================================================

export interface RepositoryTransaction {
  /**
   * Commit transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;

  /**
   * Save encounter within transaction
   */
  save(encounter: Encounter): Promise<void>;
}

// ============================================================================
// Repository Errors
// ============================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class EncounterNotFoundError extends RepositoryError {
  constructor(encounterId: string, tenantId: string) {
    super(
      `Encounter not found: ${encounterId} in tenant ${tenantId}`,
      'ENCOUNTER_NOT_FOUND',
      { encounterId, tenantId }
    );
    this.name = 'EncounterNotFoundError';
  }
}

export class TenantIsolationViolationError extends RepositoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TENANT_ISOLATION_VIOLATION', details);
    this.name = 'TenantIsolationViolationError';
  }
}

export class DatabaseConnectionError extends RepositoryError {
  constructor(originalError: Error) {
    super(
      `Database connection failed: ${originalError.message}`,
      'DATABASE_CONNECTION_ERROR',
      { originalError: originalError.message }
    );
    this.name = 'DatabaseConnectionError';
  }
}

export class TransactionError extends RepositoryError {
  constructor(operation: string, originalError: Error) {
    super(
      `Transaction ${operation} failed: ${originalError.message}`,
      'TRANSACTION_ERROR',
      { operation, originalError: originalError.message }
    );
    this.name = 'TransactionError';
  }
}
