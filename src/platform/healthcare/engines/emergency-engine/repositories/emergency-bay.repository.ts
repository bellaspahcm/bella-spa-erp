/**
 * EmergencyBay Repository Interface (Concurrency Defense Contract)
 *
 * @module platform/healthcare/engines/emergency-engine/repositories
 */

import { EmergencyBay } from '../domain/emergency-bay.resource';

export interface IEmergencyBayRepository {
  save(bay: EmergencyBay): Promise<EmergencyBay>;
  findById(tenantId: string, id: string): Promise<EmergencyBay | null>;
  findByBayCode(tenantId: string, bayCode: string): Promise<EmergencyBay | null>;
  queryBeds(tenantId: string): Promise<EmergencyBay[]>;
  /**
   * Atomic Conditional Allocation with Optimistic Concurrency Protection
   * Throws OptimisticLockError or OccupancyConflictError if allocated by another thread/request.
   */
  allocateConditional(tenantId: string, bayId: string, encounterId: string, patientId: string, expectedVersion: number): Promise<EmergencyBay>;
}
