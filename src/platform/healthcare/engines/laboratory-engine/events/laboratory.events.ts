export interface SpecimenCollectedPayload {
  labOrderId: string;
  encounterId: string;
  tenantId: string;
  sampleType: string;
  tubeColor: string;
  collectedAt: string;
}

export interface ResultVerifiedPayload {
  labOrderId: string;
  encounterId: string;
  tenantId: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  isPanicValue: boolean;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CriticalResultEscalatedPayload {
  labOrderId: string;
  encounterId: string;
  tenantId: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  verifiedBy: string;
  verifiedAt: string;
  escalationRequired: boolean;
}

export type LabDomainEvent =
  | { eventType: 'SpecimenCollected'; tenantId: string; aggregateId: string; payload: SpecimenCollectedPayload }
  | { eventType: 'ResultVerified'; tenantId: string; aggregateId: string; payload: ResultVerifiedPayload }
  | { eventType: 'CriticalResultEscalated'; tenantId: string; aggregateId: string; payload: CriticalResultEscalatedPayload };
