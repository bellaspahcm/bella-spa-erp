/**
 * PACU Engine Contract
 * 
 * Contract definition for PACU Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/pacu-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface PacuAdmissionRequest {
  tenantId: string;
  surgicalCaseId: string;
  admittedAt: string;
  dischargePolicyVersion: string;
  requestId?: string; // Idempotency
}

export interface RecordAldreteRequest {
  tenantId: string;
  surgicalCaseId: string;
  activity: number; // 0-2
  respiration: number; // 0-2
  circulation: number; // 0-2
  consciousness: number; // 0-2
  oxygenSaturation: number; // 0-2
  painScore: number; // 0-10
  requestId?: string; // Idempotency
}

export interface PacuDischargeRequest {
  tenantId: string;
  surgicalCaseId: string;
  dischargedAt: string;
  requestId?: string; // Idempotency
}

export interface PacuDischargePolicy {
  policyVersion: string;
  minimumAldreteScore: number;
  maximumPainScore: number;
}

export interface PacuAdmission {
  id: string;
  tenantId: string;
  surgicalCaseId: string;
  admittedAt: string;
  dischargedAt: string | null;
  dischargePolicyVersion: string;
  aldreteScore: number | null;
  painScore: number | null;
  status: 'admitted' | 'ready_for_discharge' | 'discharged';
  createdAt: string;
  updatedAt: string;
}

export interface PacuEngineContract extends EngineContract {
  admitToPacu(request: PacuAdmissionRequest): Promise<EngineResponse<PacuAdmission>>;
  recordAldreteScore(request: RecordAldreteRequest): Promise<EngineResponse<PacuAdmission>>;
  evaluateDischargeReadiness(tenantId: string, surgicalCaseId: string, policy: PacuDischargePolicy): Promise<EngineResponse<{ ready: boolean; blockers: string[] }>>;
  dischargeFromPacu(request: PacuDischargeRequest): Promise<EngineResponse<PacuAdmission>>;
}

export const PACU_ENGINE_CONTRACT: ContractMetadata = {
  name: 'pacu-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Post-Anesthesia Care Unit (PACU) recovery admissions, vital monitoring (Aldrete), and discharge engine',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.pacu.discharged.v1',
      version: '1.0.0',
      summary: 'Published when a patient is discharged from PACU',
      payloadSchema: { schemaId: 'pacu-discharged-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'pacu-engine',
      subscribers: ['billing-engine', 'ward-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
