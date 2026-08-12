/**
 * Supabase EmergencyDisposition Repository Infrastructure Implementation
 *
 * @module platform/healthcare/engines/emergency-engine/infrastructure
 */

import { IEmergencyDispositionRepository } from '../repositories/emergency-disposition.repository';
import { EmergencyDisposition, EmergencyDispositionProps } from '../domain/emergency-disposition.entity';

export class SupabaseEmergencyDispositionRepository implements IEmergencyDispositionRepository {
  private store: Map<string, EmergencyDispositionProps> = new Map();

  public async save(disposition: EmergencyDisposition): Promise<EmergencyDisposition> {
    const json = disposition.toJSON();
    this.store.set(`${json.tenantId}:${json.id}`, { ...json });
    return EmergencyDisposition.reconstitute({ ...json });
  }

  public async findById(tenantId: string, id: string): Promise<EmergencyDisposition | null> {
    const item = this.store.get(`${tenantId}:${id}`);
    if (!item) return null;
    return EmergencyDisposition.reconstitute({ ...item });
  }

  public async findByEncounterId(tenantId: string, encounterId: string): Promise<EmergencyDisposition | null> {
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId && item.encounterId === encounterId) {
        return EmergencyDisposition.reconstitute({ ...item });
      }
    }
    return null;
  }
}
