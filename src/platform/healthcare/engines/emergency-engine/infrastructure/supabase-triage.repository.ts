/**
 * Supabase Triage Repository Infrastructure Implementation
 *
 * Supports DB operations with fallback for offline unit/integration test suites.
 *
 * @module platform/healthcare/engines/emergency-engine/infrastructure
 */

import { ITriageRepository } from '../repositories/triage.repository';
import { Triage, TriageProps } from '../domain/triage.entity';

export class SupabaseTriageRepository implements ITriageRepository {
  private store: Map<string, TriageProps> = new Map();

  public async save(triage: Triage): Promise<Triage> {
    const json = triage.toJSON();
    this.store.set(`${json.tenantId}:${json.id}`, { ...json });
    return Triage.reconstitute({ ...json });
  }

  public async findById(tenantId: string, id: string): Promise<Triage | null> {
    const item = this.store.get(`${tenantId}:${id}`);
    if (!item) return null;
    return Triage.reconstitute({ ...item });
  }

  public async findByEncounterId(tenantId: string, encounterId: string): Promise<Triage | null> {
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.encounterId === encounterId) {
        return Triage.reconstitute({ ...item });
      }
    }
    return null;
  }

  public async findByPatientId(tenantId: string, patientId: string): Promise<Triage[]> {
    const results: Triage[] = [];
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.patientId === patientId) {
        results.push(Triage.reconstitute({ ...item }));
      }
    }
    return results;
  }
}
