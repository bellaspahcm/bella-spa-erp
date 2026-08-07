/**
 * Healthcare Platform Shared Kernel - Type Definitions
 * 
 * Common types shared across all Healthcare Platform engines.
 * These types provide the foundational domain model for healthcare operations.
 * 
 * Constitution Compliance:
 * - Law 1: All types reference Encounter as aggregate root
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * @module platform/healthcare/shared-kernel/types
 */

// ============================================================================
// Core Response Types
// ============================================================================

/**
 * Standard engine response wrapper
 * All engines must return this response type for consistent error handling
 */
export interface EngineResponse<T> {
  success: boolean;
  data?: T;
  error?: EngineError;
  metadata?: EngineResponseMetadata;
}

export interface EngineError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface EngineResponseMetadata {
  requestId: string;
  engineVersion: string;
  executionTimeMs: number;
  dataSource?: string;
}

// ============================================================================
// Healthcare Domain Types
// ============================================================================

/**
 * Encounter (Aggregate Root per Constitution Law 1)
 * All clinical activities must reference an Encounter
 */
export interface Encounter {
  id: string;
  tenantId: string;
  patientId: string;
  encounterType: EncounterType;
  encounterClass: EncounterClass;
  status: EncounterStatus;
  period: {
    start: string; // ISO 8601 datetime
    end?: string; // ISO 8601 datetime
  };
  serviceProviderId?: string; // Doctor/Practitioner ID
  departmentId?: string;
  locationId?: string;
  reasonCode?: string[];
  diagnosis?: Diagnosis[];
  createdAt: string;
  updatedAt: string;
}

export type EncounterType = 
  | 'outpatient' 
  | 'inpatient' 
  | 'emergency' 
  | 'home-health' 
  | 'virtual';

export type EncounterClass = 
  | 'AMB' // Ambulatory
  | 'EMER' // Emergency
  | 'IMP' // Inpatient
  | 'HH' // Home Health
  | 'VR'; // Virtual

export type EncounterStatus = 
  | 'planned' 
  | 'arrived' 
  | 'triaged' 
  | 'in-progress' 
  | 'on-hold' 
  | 'finished' 
  | 'cancelled';

export interface Diagnosis {
  code: string; // ICD-10 code
  display: string;
  type: 'primary' | 'secondary' | 'differential';
  onsetDateTime?: string;
  recordedDate: string;
}

/**
 * Patient (MPI - Master Patient Index)
 */
export interface Patient {
  id: string;
  tenantId: string;
  mpiId: string; // Global unique patient identifier
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  nationality?: string;
  identifiers: PatientIdentifier[];
  contact: PatientContact;
  address?: Address[];
  insuranceInfo?: InsuranceInfo[];
  emergencyContact?: EmergencyContact;
  createdAt: string;
  updatedAt: string;
}

export interface PatientIdentifier {
  type: 'national-id' | 'passport' | 'driver-license' | 'health-insurance' | 'mrn';
  value: string;
  issuedBy?: string;
  issuedDate?: string;
  expiryDate?: string;
}

export interface PatientContact {
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  preferredContactMethod?: 'phone' | 'email' | 'sms';
}

export interface Address {
  use: 'home' | 'work' | 'temp' | 'billing';
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  postalCode?: string;
  country: string;
}

export interface InsuranceInfo {
  insuranceId: string;
  policyNumber: string;
  provider: string;
  type: 'private' | 'public' | 'government' | 'self-pay';
  validFrom: string;
  validTo?: string;
  coverageLevel: number; // Percentage (0-100)
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// ============================================================================
// Clinical Types
// ============================================================================

export interface ClinicalOrder {
  id: string;
  tenantId: string;
  encounterId: string; // Law 1: Always reference Encounter
  patientId: string;
  orderType: OrderType;
  status: OrderStatus;
  orderedBy: string; // Practitioner ID
  orderedDateTime: string;
  priority: OrderPriority;
  details: Record<string, unknown>;
  result?: ClinicalResult;
  createdAt: string;
  updatedAt: string;
}

export type OrderType = 
  | 'laboratory' 
  | 'imaging' 
  | 'procedure' 
  | 'medication' 
  | 'diet';

export type OrderStatus = 
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled';

export type OrderPriority = 'stat' | 'urgent' | 'routine';

export interface ClinicalResult {
  id: string;
  orderId: string;
  resultDateTime: string;
  performedBy?: string;
  interpretation?: 'normal' | 'abnormal' | 'critical';
  value?: unknown;
  unit?: string;
  referenceRange?: string;
  notes?: string;
}

// ============================================================================
// Medication Types
// ============================================================================

export interface Medication {
  id: string;
  tenantId: string;
  code: string; // Drug code (RxNorm, ATC, etc.)
  name: string;
  genericName?: string;
  brandName?: string;
  form: MedicationForm;
  strength?: string;
  unit?: string;
  manufacturer?: string;
  activeIngredients: string[];
  routeOfAdministration: RouteOfAdministration[];
  controlledSubstance?: boolean;
  requiresPrescription: boolean;
}

export type MedicationForm = 
  | 'tablet' 
  | 'capsule' 
  | 'solution' 
  | 'injection' 
  | 'cream' 
  | 'ointment' 
  | 'inhaler';

export type RouteOfAdministration = 
  | 'oral' 
  | 'iv' 
  | 'im' 
  | 'sc' 
  | 'topical' 
  | 'inhalation' 
  | 'rectal';

export interface MedicationOrder {
  id: string;
  tenantId: string;
  encounterId: string; // Law 1: Always reference Encounter
  patientId: string;
  medicationId: string;
  status: MedicationOrderStatus;
  dosage: Dosage;
  frequency: string;
  route: RouteOfAdministration;
  startDate: string;
  endDate?: string;
  duration?: number;
  durationUnit?: 'days' | 'weeks' | 'months';
  indication?: string;
  prescribedBy: string;
  prescribedDate: string;
  dispensedBy?: string;
  dispensedDate?: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

export type MedicationOrderStatus = 
  | 'draft' 
  | 'active' 
  | 'on-hold' 
  | 'completed' 
  | 'cancelled' 
  | 'stopped';

export interface Dosage {
  value: number;
  unit: string; // mg, ml, tablets, etc.
  text?: string; // Human-readable dosage instruction
}

// ============================================================================
// Bed & Location Types
// ============================================================================

export interface Bed {
  id: string;
  tenantId: string;
  bedNumber: string;
  wardId: string;
  roomNumber?: string;
  bedType: BedType;
  status: BedStatus;
  features: BedFeature[];
  assignedPatientId?: string;
  assignedAdmissionId?: string;
  assignedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type BedType = 
  | 'standard' 
  | 'icu' 
  | 'isolation' 
  | 'maternity' 
  | 'pediatric' 
  | 'psychiatric';

export type BedStatus = 
  | 'available' 
  | 'occupied' 
  | 'reserved' 
  | 'cleaning' 
  | 'maintenance' 
  | 'out-of-service';

export type BedFeature = 
  | 'oxygen' 
  | 'suction' 
  | 'monitoring' 
  | 'ventilator' 
  | 'electric' 
  | 'bathroom';

export interface Ward {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  wardType: WardType;
  departmentId?: string;
  capacity: number;
  currentOccupancy: number;
  beds: Bed[];
  headNurseId?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
}

export type WardType = 
  | 'general' 
  | 'icu' 
  | 'emergency' 
  | 'maternity' 
  | 'pediatric' 
  | 'surgical' 
  | 'psychiatric';

// ============================================================================
// Nursing & Vital Signs Types
// ============================================================================

export interface VitalSigns {
  id: string;
  tenantId: string;
  encounterId: string; // Law 1: Always reference Encounter
  patientId: string;
  recordedBy: string; // Nurse ID
  recordedDateTime: string;
  temperature?: VitalValue;
  bloodPressure?: BloodPressure;
  heartRate?: VitalValue;
  respiratoryRate?: VitalValue;
  oxygenSaturation?: VitalValue;
  weight?: VitalValue;
  height?: VitalValue;
  painScore?: number; // 0-10 scale
  consciousnessLevel?: ConsciousnessLevel;
  notes?: string;
  createdAt: string;
}

export interface VitalValue {
  value: number;
  unit: string;
  interpretation?: 'normal' | 'low' | 'high' | 'critical';
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  unit: 'mmHg';
  interpretation?: 'normal' | 'elevated' | 'high' | 'low' | 'critical';
}

export type ConsciousnessLevel = 
  | 'alert' 
  | 'verbal-response' 
  | 'pain-response' 
  | 'unresponsive';

export interface NursingNote {
  id: string;
  tenantId: string;
  encounterId: string; // Law 1: Always reference Encounter
  patientId: string;
  noteType: NursingNoteType;
  content: string;
  recordedBy: string; // Nurse ID
  recordedDateTime: string;
  createdAt: string;
  updatedAt: string;
}

export type NursingNoteType = 
  | 'admission' 
  | 'shift-handover' 
  | 'care-plan' 
  | 'incident' 
  | 'discharge';

// ============================================================================
// Billing Types
// ============================================================================

export interface BillingItem {
  id: string;
  tenantId: string;
  encounterId: string; // Law 1: Always reference Encounter
  patientId: string;
  itemType: BillingItemType;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  insuranceCoverage?: number; // Percentage
  insurancePaid?: number;
  patientPaid?: number;
  status: BillingStatus;
  billedDate: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillingItemType = 
  | 'consultation' 
  | 'procedure' 
  | 'medication' 
  | 'laboratory' 
  | 'imaging' 
  | 'room' 
  | 'supply';

export type BillingStatus = 
  | 'pending' 
  | 'billed' 
  | 'partially-paid' 
  | 'paid' 
  | 'cancelled' 
  | 'refunded';

// ============================================================================
// Engine Contract Base
// ============================================================================

/**
 * Base interface for all Healthcare Platform engine contracts
 * All engines must implement this interface
 */
export interface EngineContract {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly contractVersion: string;
  
  /**
   * Health check endpoint for monitoring
   */
  healthCheck(): Promise<EngineHealthStatus>;
}

export interface EngineHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database?: 'ok' | 'error';
    eventBus?: 'ok' | 'error';
    dependencies?: Record<string, 'ok' | 'error'>;
  };
  message?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base interface for all Healthcare Platform domain events
 */
export interface DomainEvent<T = Record<string, unknown>> {
  eventType: string;
  eventVersion: string;
  eventId: string;
  timestamp: string;
  tenantId: string;
  aggregateId: string; // Encounter ID (Law 1)
  aggregateType: 'encounter';
  payload: T;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  source: string; // Engine name
}

// ============================================================================
// Exports
// ============================================================================

export type {
  // Core
  EngineResponse,
  EngineError,
  EngineResponseMetadata,
  EngineContract,
  EngineHealthStatus,
  DomainEvent,
  EventMetadata,
  
  // Clinical
  Encounter,
  EncounterType,
  EncounterClass,
  EncounterStatus,
  Diagnosis,
  Patient,
  PatientIdentifier,
  PatientContact,
  Address,
  InsuranceInfo,
  EmergencyContact,
  ClinicalOrder,
  OrderType,
  OrderStatus,
  OrderPriority,
  ClinicalResult,
  
  // Medication
  Medication,
  MedicationForm,
  RouteOfAdministration,
  MedicationOrder,
  MedicationOrderStatus,
  Dosage,
  
  // Bed & Location
  Bed,
  BedType,
  BedStatus,
  BedFeature,
  Ward,
  WardType,
  
  // Nursing
  VitalSigns,
  VitalValue,
  BloodPressure,
  ConsciousnessLevel,
  NursingNote,
  NursingNoteType,
  
  // Billing
  BillingItem,
  BillingItemType,
  BillingStatus,
};
