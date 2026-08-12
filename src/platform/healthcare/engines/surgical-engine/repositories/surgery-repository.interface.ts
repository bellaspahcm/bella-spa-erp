/**
 * ISurgeryRepository Interface
 * 
 * Defines DB port for SurgicalCase aggregate persistence and concurrency protection.
 * 
 * @module platform/healthcare/engines/surgical-engine/repositories/surgery-repository.interface
 */

import { SurgicalCase } from '../domain/surgical-case.entity';

export interface ISurgeryRepository {
  save(sCase: SurgicalCase): Promise<SurgicalCase>;
  findById(tenantId: string, id: string): Promise<SurgicalCase | null>;
  findByEncounterId(tenantId: string, encounterId: string): Promise<SurgicalCase | null>;
  checkOverlap(
    tenantId: string,
    orId: string,
    surgeonId: string,
    start: Date,
    end: Date,
    excludeCaseId?: string
  ): Promise<{ orOverlaps: boolean; surgeonOverlaps: boolean }>;
}
