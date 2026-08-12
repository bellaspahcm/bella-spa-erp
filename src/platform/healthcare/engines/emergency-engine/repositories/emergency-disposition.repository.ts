/**
 * EmergencyDisposition Repository Interface
 *
 * @module platform/healthcare/engines/emergency-engine/repositories
 */

import { EmergencyDisposition } from '../domain/emergency-disposition.entity';

export interface IEmergencyDispositionRepository {
  save(disposition: EmergencyDisposition): Promise<EmergencyDisposition>;
  findById(tenantId: string, id: string): Promise<EmergencyDisposition | null>;
  findByEncounterId(tenantId: string, encounterId: string): Promise<EmergencyDisposition | null>;
}
