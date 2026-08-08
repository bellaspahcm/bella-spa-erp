/**
 * Anesthesia Engine Contract
 * 
 * Contract definition for Anesthesia Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/anesthesia-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface CreateAnesthesiaRequest {
  tenantId: string;
  surgicalCaseId: string;
  requestId?: string; // Idempotency
  userId?: string;
}

export interface PreOpAssessmentRequest {
  tenantId: string;
  anesthesiaRecordId: string;
  asaClassification: number; // 1-6
  preOpAssessment: string;
  requestId?: string; // Idempotency
}

export interface RecordObservationRequest {
  tenantId: string;
  anesthesiaRecordId: string;
  observationTime: string;
  type: string; // e.g. 'HR', 'SBP', 'DBP', 'SPO2', 'TEMP'
  value: number;
  requestId?: string; // Idempotency
}

export interface RecordMedicationRequest {
  tenantId: string;
  anesthesiaRecordId: string;
  inventoryItemId: string;
  administeredAt: string;
  dose: number;
  unit: string;
  waste?: number;
  verifiedBy?: string;
  requestId?: string; // Idempotency
}

export interface PostOpAssessmentRequest {
  tenantId: string;
  anesthesiaRecordId: string;
  postOpAssessment: string;
  requestId?: string; // Idempotency
}

export type AnesthesiaRecordStatus = 'created' | 'pre_op_complete' | 'intra_op' | 'post_op' | 'completed';

export interface AnesthesiaRecord {
  id: string;
  tenantId: string;
  surgicalCaseId: string;
  asaClassification: number | null;
  status: AnesthesiaRecordStatus;
  preOpAssessment: string | null;
  postOpAssessment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnesthesiaObservation {
  id: string;
  tenantId: string;
  anesthesiaRecordId: string;
  observationTime: string;
  type: string;
  value: number;
  createdAt: string;
}

export interface AnesthesiaMedication {
  id: string;
  tenantId: string;
  anesthesiaRecordId: string;
  inventoryItemId: string;
  administeredAt: string;
  dose: number;
  unit: string;
  waste: number;
  verifiedBy: string | null;
  createdAt: string;
}

export interface AnesthesiaEngineContract extends EngineContract {
  createRecord(request: CreateAnesthesiaRequest): Promise<EngineResponse<AnesthesiaRecord>>;
  recordPreOpAssessment(request: PreOpAssessmentRequest): Promise<EngineResponse<AnesthesiaRecord>>;
  recordObservation(request: RecordObservationRequest): Promise<EngineResponse<AnesthesiaObservation>>;
  recordMedication(request: RecordMedicationRequest): Promise<EngineResponse<AnesthesiaMedication>>;
  recordPostOp(request: PostOpAssessmentRequest): Promise<EngineResponse<AnesthesiaRecord>>;
  completeRecord(tenantId: string, recordId: string, requestId?: string): Promise<EngineResponse<AnesthesiaRecord>>;
}

export const ANESTHESIA_ENGINE_CONTRACT: ContractMetadata = {
  name: 'anesthesia-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Pre-anesthetic evaluation, intra-operative vitals log, controlled substances records, and post-anesthetic tracking',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.anesthesia.preop.completed.v1',
      version: '1.0.0',
      summary: 'Published when pre-operative anesthesia evaluation is completed',
      payloadSchema: { schemaId: 'anesthesia-preop-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'anesthesia-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.anesthesia.observation.recorded.v1',
      version: '1.0.0',
      summary: 'Published when vital sign observations are captured during anesthesia',
      payloadSchema: { schemaId: 'anesthesia-observation-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'anesthesia-engine',
      subscribers: ['clinical-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
