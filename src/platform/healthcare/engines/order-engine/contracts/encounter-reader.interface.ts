/**
 * Encounter Access Boundary for Clinical Order Service
 * 
 * Source of truth: Encounter Engine
 * Consumer: Clinical Order Service validates order eligibility
 * 
 * Purpose: Prevent Clinical Order Service from duplicating Encounter business logic
 */

export interface EncounterSnapshot {
  readonly encounterId: string;
  readonly patientPartyId: string;
  readonly status: EncounterStatus;
  readonly encounterType: string;
  readonly admittedAt: Date;
  readonly dischargedAt: Date | null;
}

export type EncounterStatus = 
  | 'REGISTERED'      // Patient registered, not yet admitted
  | 'IN_PROGRESS'     // Active encounter, can create orders
  | 'FINISHED'        // Discharged, cannot create new orders
  | 'CANCELLED';      // Cancelled, cannot create orders

export interface EncounterReader {
  /**
   * Get encounter snapshot for order validation
   * 
   * @throws EncounterNotFoundError if encounter does not exist
   * @throws TenantIsolationError if encounter belongs to different tenant
   */
  getEncounterSnapshot(tenantId: string, encounterId: string): Promise<EncounterSnapshot>;
  
  /**
   * Validate encounter allows creating new orders
   * 
   * Business rules:
   * - Encounter must exist
   * - Encounter status must be IN_PROGRESS (not FINISHED, CANCELLED)
   * - Encounter belongs to correct tenant
   * 
   * @returns true if encounter allows orders, false otherwise
   */
  canCreateOrders(tenantId: string, encounterId: string): Promise<boolean>;
}

export class EncounterNotFoundError extends Error {
  constructor(
    public readonly encounterId: string,
    public readonly tenantId: string,
  ) {
    super(`Encounter ${encounterId} not found for tenant ${tenantId}`);
    this.name = 'EncounterNotFoundError';
  }
}

export class TenantIsolationError extends Error {
  constructor(
    public readonly encounterId: string,
    public readonly expectedTenantId: string,
    public readonly actualTenantId: string,
  ) {
    super(
      `Encounter ${encounterId} belongs to tenant ${actualTenantId}, expected ${expectedTenantId}`
    );
    this.name = 'TenantIsolationError';
  }
}
