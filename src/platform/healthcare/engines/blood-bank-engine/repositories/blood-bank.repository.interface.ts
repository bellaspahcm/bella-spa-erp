/**
 * Blood Bank Repository Interface
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

import { BloodCrossmatch } from '../domain/blood-crossmatch.entity';
import { BloodComponent, BloodUnitStatus, TransfusionVerificationSnapshot } from '../domain/blood-component.vo';

export interface IBloodBankRepository {
  findCrossmatchById(tenantId: string, id: string): Promise<BloodCrossmatch | null>;
  saveCrossmatch(crossmatch: BloodCrossmatch): Promise<void>;
  
  findBloodUnitById(tenantId: string, id: string): Promise<BloodComponent | null>;
  saveBloodUnitStatus(
    tenantId: string,
    unitId: string,
    status: BloodUnitStatus,
    expectedStatus?: BloodUnitStatus
  ): Promise<boolean>;
  
  saveTransfusionVerification(
    tenantId: string,
    encounterId: string,
    bloodUnitId: string,
    crossmatchId: string,
    data: TransfusionVerificationSnapshot,
    verifiedByA: string,
    verifiedByB: string
  ): Promise<string>;
  
  createTransfusionRecord(
    tenantId: string,
    encounterId: string,
    bloodUnitId: string,
    verificationId: string,
    startedAt: string
  ): Promise<string>;
  
  getTransfusionRecord(
    tenantId: string,
    transfusionId: string
  ): Promise<{ id: string; encounterId: string; bloodUnitId: string; status: string } | null>;
  
  abortTransfusionWithReaction(
    tenantId: string,
    transfusionId: string,
    unitId: string,
    encounterId: string,
    completedAt: string,
    reactionDetails: string
  ): Promise<void>;

  completeTransfusionRecord(
    tenantId: string,
    transfusionId: string,
    completedAt: string
  ): Promise<void>;
  
  isEncounterLocked(tenantId: string, encounterId: string): Promise<boolean>;
}
