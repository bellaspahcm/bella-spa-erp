/**
 * Pharmacy Engine Contract
 * 
 * Contract definition for Pharmacy Engine (Healthcare Platform).
 * Includes MAR (Medication Administration Record) operations.
 * 
 * @module platform/healthcare/contracts/pharmacy-engine
 */

import type { EngineContract, EngineResponse, MedicationOrder } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface MARAdministrationRequest {
  tenantId: string;
  encounterId: string;
  patientId: string;
  medicationOrderId: string;
  administeredBy: string;
  administeredAt: string;
  dosageGiven: { value: number; unit: string };
  route: string;
  site?: string;
  notes?: string;
}

export interface PharmacyEngineContract extends EngineContract {
  recordMedicationAdministration(request: MARAdministrationRequest): Promise<EngineResponse<{ id: string }>>;
  getMedicationOrders(tenantId: string, encounterId: string): Promise<EngineResponse<MedicationOrder[]>>;
  dispenseMedication(request: { tenantId: string; medicationOrderId: string; dispensedBy: string }): Promise<EngineResponse<MedicationOrder>>;
}

export const PHARMACY_ENGINE_CONTRACT: ContractMetadata = {
  name: 'pharmacy-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Pharmacy and MAR engine for medication management',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'MedicationAdministered',
      version: '1.0.0',
      summary: 'Published when medication is administered to patient',
      payloadSchema: { schemaId: 'medication-administered-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'pharmacy-engine',
      subscribers: ['clinical-engine', 'billing-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
