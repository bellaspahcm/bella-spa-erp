/**
 * OR Readiness Engine Contract
 * 
 * Contract definition for OR Readiness Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/or-readiness-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface ORReadinessResult {
  ready: boolean;
  status: 'ready' | 'not_ready' | 'unknown';
  blockers: string[];
  details: {
    consentStatus: 'signed' | 'missing' | 'unknown';
    roomCleaningStatus: 'cleaned' | 'dirty' | 'unknown';
    cssdCyclesCompleted: boolean;
    teamAssigned: boolean;
    checklistCompleted: boolean;
  };
}

export interface ConsentStatusProvider {
  getConsentStatus(encounterId: string): Promise<'signed' | 'missing' | 'unknown'>;
}

export interface RoomReadinessProvider {
  getCleaningStatus(operatingRoomId: string): Promise<'cleaned' | 'dirty' | 'unknown'>;
}

export interface ORReadinessEngineContract extends EngineContract {
  evaluateReadiness(tenantId: string, surgicalCaseId: string): Promise<EngineResponse<ORReadinessResult>>;
}

export const OR_READINESS_ENGINE_CONTRACT: ContractMetadata = {
  name: 'or-readiness-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Operating Room pre-op readiness evaluation engine checking equipment, consent, sterilization, and cleaning',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.or.ready.v1',
      version: '1.0.0',
      summary: 'Published when an OR is evaluated and declared fully READY',
      payloadSchema: { schemaId: 'or-ready-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'or-readiness-engine',
      subscribers: ['surgical-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
