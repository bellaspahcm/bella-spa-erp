/**
 * CSSD Engine Contract
 * 
 * Contract definition for CSSD Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/cssd-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface RegisterEquipmentRequest {
  tenantId: string;
  name: string;
  serialNumber: string;
  requestId?: string; // Idempotency
}

export interface StartCssdCycleRequest {
  tenantId: string;
  cycleNumber: string;
  equipmentIds: string[];
  startedAt: string;
  requestId?: string; // Idempotency
}

export interface CompleteCssdCycleRequest {
  tenantId: string;
  cycleId: string;
  completedAt: string;
  indicatorResult: 'pass' | 'fail';
  requestId?: string; // Idempotency
}

export interface IssueEquipmentRequest {
  tenantId: string;
  surgicalCaseId: string;
  equipmentId: string;
  cssdCycleId: string;
  usedAt: string;
  requestId?: string; // Idempotency
}

export interface ReturnEquipmentRequest {
  tenantId: string;
  surgicalCaseId: string;
  equipmentId: string;
  cssdCycleId: string;
  returnedAt: string;
  requestId?: string; // Idempotency
}

export interface Equipment {
  id: string;
  tenantId: string;
  name: string;
  serialNumber: string;
  status: 'available' | 'in_use' | 'sterile_hold' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface CssdCycle {
  id: string;
  tenantId: string;
  cycleNumber: string;
  startedAt: string;
  completedAt: string | null;
  indicatorResult: 'pass' | 'fail' | 'pending' | null;
  createdAt: string;
  updatedAt: string;
}

export interface OREquipmentUsage {
  id: string;
  tenantId: string;
  surgicalCaseId: string;
  equipmentId: string;
  cssdCycleId: string;
  usedAt: string;
  returnedAt: string | null;
}

export interface TraceabilityReport {
  equipmentId: string;
  equipmentName: string;
  serialNumber: string;
  cssdCycleId: string;
  cycleNumber: string;
  startedAt: string;
  completedAt: string | null;
  indicatorResult: 'pass' | 'fail' | 'pending' | null;
  usedAt: string;
  returnedAt: string | null;
}

export interface CssdEngineContract extends EngineContract {
  registerEquipment(request: RegisterEquipmentRequest): Promise<EngineResponse<Equipment>>;
  startCycle(request: StartCssdCycleRequest): Promise<EngineResponse<CssdCycle>>;
  completeCycle(request: CompleteCssdCycleRequest): Promise<EngineResponse<CssdCycle>>;
  issueEquipment(request: IssueEquipmentRequest): Promise<EngineResponse<OREquipmentUsage>>;
  returnEquipment(request: ReturnEquipmentRequest): Promise<EngineResponse<OREquipmentUsage>>;
  getEquipmentTraceability(tenantId: string, surgicalCaseId: string): Promise<EngineResponse<TraceabilityReport[]>>;
}

export const CSSD_ENGINE_CONTRACT: ContractMetadata = {
  name: 'cssd-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Central Sterile Services Department (CSSD) sterilization tracking and lifecycle engine',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.cssd.cycle.completed.v1',
      version: '1.0.0',
      summary: 'Published when a CSSD sterilization cycle completes',
      payloadSchema: { schemaId: 'cssd-cycle-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'cssd-engine',
      subscribers: ['or-readiness-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
