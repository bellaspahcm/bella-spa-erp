/**
 * Clinical Order Repository Interface
 * 
 * PURPOSE: Define persistence contract for ClinicalOrder aggregate
 * 
 * IMPLEMENTATION STATUS:
 *   - Interface: ✅ DEFINED
 *   - Supabase Implementation: ⛔ BLOCKED (awaiting migration verification)
 *   - Integration Tests: ⛔ BLOCKED (awaiting database)
 * 
 * INVARIANTS ENFORCED BY REPOSITORY:
 *   1. Tenant Isolation: All queries MUST filter by tenantId
 *   2. Patient Consistency: patient_party_id MUST match encounter.patient_party_id (DB enforced via composite FK)
 *   3. Idempotency: Same (tenantId, requestId) returns existing order (DB enforced via UNIQUE index)
 *   4. Optimistic Locking: Version mismatch throws OptimisticLockError
 *   5. Encounter Linkage: encounterId is required and MUST reference valid encounter (DB enforced via FK)
 * 
 * DOMAIN <-> PERSISTENCE MAPPING:
 *   ClinicalOrder (domain) <-> hc_clinical_orders (table)
 *   - orderId          <-> id
 *   - tenantId         <-> tenant_id
 *   - encounterId      <-> encounter_id
 *   - patientId        <-> patient_party_id (ADR-011: derived from encounter)
 *   - orderType        <-> order_type
 *   - status           <-> order_status
 *   - priority         <-> priority
 *   - orderedBy        <-> ordered_by
 *   - orderDetails     <-> order_details (JSONB)
 *   - cdsCheckStatus   <-> cds_check_status
 *   - requestId        <-> request_id (idempotency key)
 *   - version          <-> version (optimistic locking)
 *   - createdAt        <-> created_at
 *   - updatedAt        <-> updated_at
 */

import type { ClinicalOrder } from '../domain/clinical-order.entity';
import type { OrderType, OrderStatus, OrderPriority } from '../../../contracts/order-engine.contract';

/**
 * Repository Query Filters
 */
export interface OrderQueryFilters {
  tenantId: string;  // ALWAYS required (tenant isolation)
  encounterId?: string;
  patientId?: string;
  orderType?: OrderType;
  orderStatus?: OrderStatus;
  priority?: OrderPriority;
  orderedBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Repository Save Options
 */
export interface OrderSaveOptions {
  /**
   * Expected version for optimistic locking
   * If provided, throws OptimisticLockError if version mismatch
   */
  expectedVersion?: number;
}

/**
 * Optimistic Lock Error
 * Thrown when attempting to update an order with stale version
 */
export class OptimisticLockError extends Error {
  constructor(
    public readonly orderId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Order ${orderId} version mismatch: expected ${expectedVersion}, actual ${actualVersion}. ` +
      `Order was modified by another user.`
    );
    this.name = 'OptimisticLockError';
  }
}

/**
 * Idempotency Conflict Error
 * Thrown when attempting to create order with duplicate (tenantId, requestId)
 */
export class IdempotencyConflictError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly requestId: string,
    public readonly existingOrderId: string
  ) {
    super(
      `Order with requestId ${requestId} already exists in tenant ${tenantId}: ${existingOrderId}`
    );
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Clinical Order Repository Contract
 * 
 * CRITICAL: This interface defines the persistence boundary.
 *           - Repository MUST NOT contain business logic
 *           - Repository MUST NOT validate domain invariants (Domain aggregate handles that)
 *           - Repository ONLY handles persistence, reconstitution, and queries
 */
export interface IOrderRepository {
  /**
   * Create new order
   * 
   * @throws IdempotencyConflictError if requestId already exists for tenant
   * @throws Error if database constraint violated (e.g., invalid encounterId, patient mismatch)
   */
  create(order: ClinicalOrder, requestId?: string): Promise<ClinicalOrder>;

  /**
   * Find order by ID
   * 
   * @returns Order if found, null otherwise
   * @throws Error if tenantId mismatch (order exists but belongs to different tenant)
   */
  findById(tenantId: string, orderId: string): Promise<ClinicalOrder | null>;

  /**
   * Find order by request ID (idempotency check)
   * 
   * @returns Order if found, null otherwise
   */
  findByRequestId(tenantId: string, requestId: string): Promise<ClinicalOrder | null>;

  /**
   * Find orders by filters
   * 
   * @returns Array of orders matching filters (empty if none found)
   */
  findByFilters(filters: OrderQueryFilters): Promise<ClinicalOrder[]>;

  /**
   * Find active orders for encounter
   * Active = status NOT IN ('COMPLETED', 'DISCONTINUED', 'REJECTED')
   * 
   * @returns Array of active orders (empty if none found)
   */
  findActiveByEncounter(tenantId: string, encounterId: string): Promise<ClinicalOrder[]>;

  /**
   * Update order with optimistic locking
   * 
   * CRITICAL: This method increments version and checks expectedVersion if provided
   * 
   * @throws OptimisticLockError if expectedVersion provided and doesn't match
   * @throws Error if order not found or database constraint violated
   */
  update(order: ClinicalOrder, options?: OrderSaveOptions): Promise<ClinicalOrder>;

  /**
   * Delete order (soft delete - sets status to DISCONTINUED)
   * 
   * NOTE: Physical delete not supported (audit trail requirement)
   * 
   * @throws Error if order not found or already in terminal state
   */
  softDelete(tenantId: string, orderId: string, discontinuedBy: string, reason: string): Promise<void>;

  /**
   * Check if order exists (lightweight existence check without full reconstitution)
   * 
   * @returns true if order exists for tenant, false otherwise
   */
  exists(tenantId: string, orderId: string): Promise<boolean>;
}
