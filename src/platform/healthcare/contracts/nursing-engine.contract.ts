/**
 * Nursing Engine Contract
 * 
 * Contract definition for Nursing Engine (Healthcare Platform).
 * Defines API endpoints, events, and schemas for nursing operations.
 * 
 * @module platform/healthcare/contracts/nursing-engine
 */

import type { EngineContract, EngineResponse, VitalSigns, NursingNote } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';
import type { MARItemSummary } from '../engines/nursing-engine/contracts/mar-reader.interface';
export type { MARItemSummary } from '../engines/nursing-engine/contracts/mar-reader.interface';

export interface MARAdministrationEntry {
  tenantId: string;
  admissionId: string;
  encounterId: string;
  patientId: string;
  prescriptionItemId?: string; // optional — no FK to hc_prescriptions
  drugName: string;
  dosage: string;
  route: string;
  scheduledTime: string; // ISO
  administeredBy: string;
  notes?: string;
}

export interface RecordVitalsRequest {
  tenantId: string;
  encounterId: string;
  patientId: string;
  recordedBy: string;
  temperature?: { value: number; unit: string };
  bloodPressure?: { systolic: number; diastolic: number };
  heartRate?: { value: number; unit: string };
  respiratoryRate?: { value: number; unit: string };
  oxygenSaturation?: { value: number; unit: string };
  weight?: { value: number; unit: string };
  height?: { value: number; unit: string };
  painScore?: number;
  consciousnessLevel?: string;
  notes?: string;
}

export interface NursingEngineContract extends EngineContract {
  recordVitalSigns(request: RecordVitalsRequest): Promise<EngineResponse<VitalSigns>>;
  getVitalSigns(tenantId: string, encounterId: string, limit?: number): Promise<EngineResponse<VitalSigns[]>>;
  createNursingNote(request: { tenantId: string; encounterId: string; patientId: string; noteType: string; content: string; recordedBy: string }): Promise<EngineResponse<NursingNote>>;
  // H1.4 MAR — read/write hc_medication_administration_records
  getMARByAdmission(tenantId: string, admissionId: string): Promise<EngineResponse<MARItemSummary[]>>;
  recordAdministration(entry: MARAdministrationEntry): Promise<EngineResponse<MARItemSummary>>;
}

export const NURSING_ENGINE_CONTRACT: ContractMetadata = {
  name: 'nursing-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Nursing operations engine for vital signs and nursing notes',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'VitalsRecorded',
      version: '1.0.0',
      summary: 'Published when vital signs are recorded',
      payloadSchema: { schemaId: 'vitals-recorded-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'nursing-engine',
      subscribers: ['clinical-engine', 'ai-runtime'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
