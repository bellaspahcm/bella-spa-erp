/**
 * CQRS Query Capabilities Interfaces for Healthcare Kernel
 * Pure Data Reading. Zero `any` allowed.
 */

import type { HealthcareResourceDTO, HealthcareEncounterDTO, HealthcareClinicalRecordDTO } from '../domain/types';

export interface ResourceQueryCapability {
  readonly id: string;
  readonly version: string;
  readonly capabilityType: 'query';
  getResources(tenantId: string): Promise<readonly HealthcareResourceDTO[]>;
  getResourceById(tenantId: string, resourceId: string): Promise<HealthcareResourceDTO | undefined>;
}

export interface ClinicalQueryCapability {
  readonly id: string;
  readonly version: string;
  readonly capabilityType: 'query';
  getClinicalRecord(encounterId: string): Promise<HealthcareClinicalRecordDTO | undefined>;
  getPatientEncounters(patientId: string): Promise<readonly HealthcareEncounterDTO[]>;
}
