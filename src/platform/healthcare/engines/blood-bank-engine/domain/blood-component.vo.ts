/**
 * Blood Component Value Objects & Verification Snapshot Types
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

export type BloodUnitStatus =
  | 'RECEIVED'
  | 'QUARANTINED'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'ISSUED'
  | 'TRANSFUSING'
  | 'TRANSFUSED'
  | 'EXPIRED'
  | 'DISCARDED'
  | 'RETURNED'
  | 'REJECTED';

export interface BloodComponent {
  readonly id: string;
  readonly tenantId: string;
  readonly unitNumber: string;
  readonly bloodType: 'A' | 'B' | 'AB' | 'O';
  readonly rhFactor: 'POSITIVE' | 'NEGATIVE';
  readonly componentType: 'RBC';
  readonly status: BloodUnitStatus;
  readonly expiryDate: string;
  readonly version: number;
}

export interface TransfusionVerificationSnapshot {
  readonly patientId: string;
  readonly unitNumber: string;
  readonly bloodType: 'A' | 'B' | 'AB' | 'O';
  readonly rhFactor: 'POSITIVE' | 'NEGATIVE';
  readonly component: 'RBC';
  readonly crossmatchResult: 'COMPATIBLE' | 'INCOMPATIBLE';
}
