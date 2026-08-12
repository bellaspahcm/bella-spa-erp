/**
 * Triage Repository Interface
 *
 * @module platform/healthcare/engines/emergency-engine/repositories
 */

import { Triage } from '../domain/triage.entity';

export interface ITriageRepository {
  save(triage: Triage): Promise<Triage>;
  findById(tenantId: string, id: string): Promise<Triage | null>;
  findByEncounterId(tenantId: string, encounterId: string): Promise<Triage | null>;
  findByPatientId(tenantId: string, patientId: string): Promise<Triage[]>;
}
