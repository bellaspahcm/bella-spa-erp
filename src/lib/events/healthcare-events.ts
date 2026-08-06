/**
 * BELLA HEALTHCARE PLATFORM — EVENT CONTRACT REGISTRY
 * 
 * Governance: ADR-008 Centralized Event Contract Registry
 * Versioning: Semantic Event Versioning (.v1, .v2)
 */

export interface BaseDomainEvent<T = unknown> {
  eventId: string;
  eventName: string;
  eventVersion: string; // e.g. "v1"
  tenantId: string;
  timestamp: string;
  producerCapability: string;
  payload: T;
}

export interface EncounterStartedPayload {
  encounterId: string;
  patientId: string;
  customerId: string;
  practitionerId: string;
  facilityId: string;
  priority: string;
  startedAt: string;
}

export interface EncounterCompletedPayload {
  encounterId: string;
  patientId: string;
  primaryDiagnosisCode?: string;
  completedAt: string;
}

export interface ClinicalOrderCreatedPayload {
  orderId: string;
  encounterId: string;
  patientId: string;
  orderType: string;
  itemCount: number;
  orderedAt: string;
}

export interface LabResultVerifiedPayload {
  orderId: string;
  encounterId: string;
  patientId: string;
  verifiedBy: string;
  hasPanicValue: boolean;
  verifiedAt: string;
}

export interface PrescriptionIssuedPayload {
  prescriptionId: string;
  encounterId: string;
  patientId: string;
  doctorPractitionerId: string;
  itemCount: number;
  issuedAt: string;
}

export interface HealthcareMedicalBillingPayload {
  invoiceId: string;
  encounterId: string;
  patientId: string;
  totalAmount: number;
  bhytCoveredAmount: number;
  patientPayableAmount: number;
  createdAt: string;
}

/**
 * Event Registry Schemas Catalog
 */
export const HEALTHCARE_EVENT_CATALOG = {
  ENCOUNTER_STARTED: 'EncounterStarted.v1',
  ENCOUNTER_COMPLETED: 'EncounterCompleted.v1',
  CLINICAL_ORDER_CREATED: 'ClinicalOrderCreated.v1',
  LAB_RESULT_VERIFIED: 'LabResultVerified.v1',
  PRESCRIPTION_ISSUED: 'PrescriptionIssued.v1',
  BILLING_INVOICE_CREATED: 'HealthcareInvoiceCreated.v1',
} as const;

/**
 * Helper to construct strongly typed Domain Events for Healthcare Platform
 */
export function createHealthcareEvent<T>(
  eventName: string,
  eventVersion: string,
  tenantId: string,
  producerCapability: string,
  payload: T
): BaseDomainEvent<T> {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    eventName,
    eventVersion,
    tenantId,
    timestamp: new Date().toISOString(),
    producerCapability,
    payload,
  };
}
