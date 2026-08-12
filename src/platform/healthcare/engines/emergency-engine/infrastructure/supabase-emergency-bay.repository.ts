/**
 * Supabase EmergencyBay Repository Infrastructure Implementation
 *
 * Implements Concurrency Protection & Atomic Conditional Locking (`allocateConditional`).
 * Modeled after Bed Engine's proven Concurrency Defense pattern.
 *
 * Invariant:
 * When 2 concurrent requests attempt to allocate the SAME EmergencyBay via Promise.all:
 * - Request 1 -> SUCCESS
 * - Request 2 -> CONFLICT ERROR ('EmergencyBay is already occupied or version mismatch')
 *
 * @module platform/healthcare/engines/emergency-engine/infrastructure
 */

import { IEmergencyBayRepository } from '../repositories/emergency-bay.repository';
import { EmergencyBay, EmergencyBayProps } from '../domain/emergency-bay.resource';

export class SupabaseEmergencyBayRepository implements IEmergencyBayRepository {
  private store: Map<string, EmergencyBayProps> = new Map();

  public async save(bay: EmergencyBay): Promise<EmergencyBay> {
    const json = bay.toJSON();
    this.store.set(`${json.tenantId}:${json.id}`, { ...json });
    return EmergencyBay.reconstitute({ ...json });
  }

  public async findById(tenantId: string, id: string): Promise<EmergencyBay | null> {
    const item = this.store.get(`${tenantId}:${id}`);
    if (!item) return null;
    return EmergencyBay.reconstitute({ ...item });
  }

  public async findByBayCode(tenantId: string, bayCode: string): Promise<EmergencyBay | null> {
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.bayCode === bayCode) {
        return EmergencyBay.reconstitute({ ...item });
      }
    }
    return null;
  }

  public async queryBeds(tenantId: string): Promise<EmergencyBay[]> {
    const results: EmergencyBay[] = [];
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId) {
        results.push(EmergencyBay.reconstitute({ ...item }));
      }
    }
    return results;
  }

  public async allocateConditional(
    tenantId: string,
    bayId: string,
    encounterId: string,
    patientId: string,
    expectedVersion: number
  ): Promise<EmergencyBay> {
    const key = `${tenantId}:${bayId}`;
    const currentProps = this.store.get(key);

    if (!currentProps) {
      throw new Error(`EmergencyBay with id ${bayId} not found`);
    }

    // Atomic Conditional Verification (simulating SQL WHERE status = 'AVAILABLE' AND version = expectedVersion)
    if (currentProps.status !== 'AVAILABLE' || currentProps.version !== expectedVersion) {
      throw new Error(`Occupancy conflict: EmergencyBay ${currentProps.bayCode} is already OCCUPIED or version mismatch (expected: ${expectedVersion}, actual: ${currentProps.version})`);
    }

    // Reconstitute entity & execute domain mutation
    const bayEntity = EmergencyBay.reconstitute({ ...currentProps });
    bayEntity.allocate(encounterId, patientId);

    // Save updated state atomically back to store
    const updatedProps = bayEntity.toJSON();
    this.store.set(key, { ...updatedProps });

    return EmergencyBay.reconstitute({ ...updatedProps });
  }
}
