/**
 * CQRS Command Capabilities Interfaces for Healthcare Kernel
 * Transactional Actions & Event Dispatching. Zero `any` allowed.
 */

import type { HealthcareClinicalRecordDTO } from '../domain/types';

export interface AssignResourceCommand {
  readonly resourceId: string;
  readonly encounterId: string;
  readonly tenantId: string;
}

export interface UpdateClinicalRecordCommand {
  readonly encounterId: string;
  readonly recordData: HealthcareClinicalRecordDTO;
}

export interface ResourceCommandCapability {
  readonly id: string;
  readonly version: string;
  readonly capabilityType: 'command';
  assignResource(command: AssignResourceCommand): Promise<{ readonly success: boolean; readonly message?: string }>;
  releaseResource(tenantId: string, resourceId: string): Promise<{ readonly success: boolean }>;
}

export interface ClinicalCommandCapability {
  readonly id: string;
  readonly version: string;
  readonly capabilityType: 'command';
  saveClinicalRecord(command: UpdateClinicalRecordCommand): Promise<{ readonly success: boolean }>;
}
