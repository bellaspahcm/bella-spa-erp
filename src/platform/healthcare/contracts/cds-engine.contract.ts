/**
 * CDS Engine Contract — Phase C: Clinical Decision Support
 *
 * Defines the public API contract for the Clinical Decision Support Engine.
 * This engine provides the Clinical Intelligence Layer over the existing
 * Clinical Operations & Safety Infrastructure (B1–B4).
 *
 * Architecture:
 *   Global Clinical Knowledge (hc_drugs, hc_drug_interactions, hc_clinical_protocols)
 *   + Tenant Clinical Policy (hc_tenant_cds_policies)
 *   → CDS Engine → Immutable Calculation Provenance (hc_clinical_calculations)
 *
 * Constitution:
 *   - Law 1: Encounter as aggregate root — all checks reference encounterId
 *   - Law 5: Events published for every BLOCK/ABSOLUTE_BLOCK decision
 *   - Law 11: Zero `any` types
 *
 * @module platform/healthcare/contracts/cds-engine.contract
 */

import type { EngineResponse, EngineHealthStatus } from '../shared-kernel/types';

// ============================================================================
// CDS Domain Types
// ============================================================================

/**
 * Clinical severity of an alert — how serious is the risk?
 * Independent from enforcement (what should the system do about it).
 */
export type CdsSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

/**
 * Enforcement level — how the system responds to the alert.
 *
 * ABSOLUTE_BLOCK  → Cannot proceed under any circumstances. No override possible.
 *                   Example: ANAPHYLAXIS allergy, Pregnancy Category X.
 * BLOCK           → Cannot proceed without physician justification + override.
 *                   Example: Major DDI (Warfarin+Amiodarone), critical dose violation.
 * ACKNOWLEDGE     → Can proceed but physician must acknowledge the alert.
 *                   Example: Minor DDI, moderate allergy.
 * INFORMATIONAL   → Logged only, no interaction required.
 *                   Example: Spacing requirement (antacid + fluoroquinolone).
 */
export type CdsEnforcement = 'ABSOLUTE_BLOCK' | 'BLOCK' | 'ACKNOWLEDGE' | 'INFORMATIONAL';

/**
 * Type of CDS alert — which sub-engine generated it.
 */
export type CdsAlertType = 'DRUG_INTERACTION' | 'ALLERGY' | 'PROTOCOL';

/**
 * A single clinical decision support alert.
 * Multiple alerts may be generated for a single CDS check.
 */
export interface CdsAlert {
  /** Unique identifier for this alert instance */
  alertId: string;
  /** Which CDS sub-engine generated this alert */
  alertType: CdsAlertType;
  /** Clinical significance of the risk */
  severity: CdsSeverity;
  /** System enforcement response — independent of severity */
  enforcement: CdsEnforcement;
  /**
   * Whether a clinician can override this alert.
   * Always false when enforcement = ABSOLUTE_BLOCK.
   */
  canOverride: boolean;
  /** Human-readable description of the alert */
  message: string;
  /** Pharmacological mechanism (DDI only) */
  mechanism?: string;
  /** Clinical recommendation for management */
  managementGuidance?: string;
  /** Strength of evidence: A (RCT), B (Cohort), C (Case report) */
  evidenceLevel?: 'A' | 'B' | 'C';
  /** Source DDI interaction ID or protocol ID */
  sourceId?: string;
}

/**
 * Aggregated result of a complete CDS evaluation.
 * Written to hc_clinical_calculations as an immutable audit record.
 */
export interface CdsCheckResult {
  /** True if no BLOCK or ABSOLUTE_BLOCK enforcement applies */
  passed: boolean;
  /**
   * True if any alert has enforcement = ABSOLUTE_BLOCK.
   * When hardBlocked = true, the order MUST NOT proceed under any circumstances.
   */
  hardBlocked: boolean;
  /** All alerts found (including INFO-level) */
  alerts: CdsAlert[];
  /** Reference ID in hc_clinical_calculations (immutable audit record) */
  calculationId: string;
  /** Which global KB snapshot was used for this evaluation */
  knowledgeBaseVersion: string;
  /** Which tenant policy version was applied */
  policyVersion: string;
  /** ISO timestamp of when the evaluation was performed */
  evaluatedAt: string;
}

// ============================================================================
// CDS Request Types
// ============================================================================

/** Base context shared across all CDS requests */
interface CdsRequestBase {
  /** Idempotency key — prevents duplicate CDS calculations for the same clinical decision */
  requestId: string;
  tenantId: string;
  /** Encounter aggregate root (Constitution Law 1) */
  encounterId: string;
  /** Patient identifier for allergy and protocol checks */
  patientId: string;
  /** Correlation chain for distributed tracing */
  correlationId?: string;
  causationId?: string;
}

export interface CheckDrugInteractionsRequest extends CdsRequestBase {
  /** The drug being prescribed (ATC drug code) */
  proposedDrugCode: string;
  /** All currently active medications for this patient (ATC drug codes) */
  currentMedicationCodes: string[];
}

export interface CheckAllergyRequest extends CdsRequestBase {
  /** The drug being prescribed (ATC drug code) */
  proposedDrugCode: string;
  /** Drug class of the proposed drug (for class-level allergy matching) */
  proposedDrugClass?: string;
}

export interface CheckProtocolAdherenceRequest extends CdsRequestBase {
  /** The drug being prescribed */
  proposedDrugCode: string;
  /** Drug class for protocol matching */
  proposedDrugClass?: string;
  /** Proposed daily dose in mg */
  proposedDoseMg?: number;
  /** Patient age in years (for age-based contraindications) */
  patientAgeYears?: number;
  /** Patient weight in kg (for weight-based dosing) */
  patientWeightKg?: number;
  /** Estimated GFR — for renal contraindication checks */
  patientEgfr?: number;
  /** Child-Pugh class A/B/C — for hepatic contraindications */
  patientHepaticClass?: 'A' | 'B' | 'C';
  /** Patient pregnancy status */
  patientPregnant?: boolean;
}

export interface GenerateCdsSummaryRequest extends CdsRequestBase {
  /** The drug being prescribed */
  proposedDrugCode: string;
  /** Drug class of the proposed drug */
  proposedDrugClass?: string;
  /** All currently active medications for DDI check */
  currentMedicationCodes: string[];
  /** Proposed daily dose in mg (for protocol adherence) */
  proposedDoseMg?: number;
  /** Patient age in years */
  patientAgeYears?: number;
  /** Patient weight in kg */
  patientWeightKg?: number;
  /** Patient eGFR */
  patientEgfr?: number;
  /** Patient hepatic status */
  patientHepaticClass?: 'A' | 'B' | 'C';
  /** Patient pregnancy status */
  patientPregnant?: boolean;
}

// ============================================================================
// Patient Allergy Types
// ============================================================================

export type AllergenType = 'DRUG' | 'DRUG_CLASS' | 'FOOD' | 'ENVIRONMENT' | 'CONTRAST';
export type AllergyReactionType = 'ANAPHYLAXIS' | 'ANGIOEDEMA' | 'RASH' | 'URTICARIA' | 'GI' | 'RESPIRATORY' | 'OTHER';
export type AllergySeverity = 'LIFE_THREATENING' | 'SEVERE' | 'MODERATE' | 'MILD';

export interface RecordAllergyRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  allergenType: AllergenType;
  allergenCode: string;
  allergenName: string;
  reactionType: AllergyReactionType;
  severity: AllergySeverity;
  onsetDate?: string;
  recordedBy: string;
}

export interface PatientAllergy {
  id: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  allergenType: AllergenType;
  allergenCode: string;
  allergenName: string;
  reactionType: AllergyReactionType;
  severity: AllergySeverity;
  onsetDate?: string;
  recordedBy: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// CDS Engine Contract Interface
// ============================================================================

export const CDS_ENGINE_CONTRACT = {
  engineId: 'cds-engine',
  version: '1.0.0',
  description: 'Clinical Decision Support Engine — Drug Interaction, Allergy, Protocol sub-engines with Clinical Provenance',
};

export interface CdsEngineContract {
  readonly engineName: 'cds-engine';
  readonly engineVersion: string;

  /**
   * Check for drug-drug interactions between proposed drug and active medications.
   * Bidirectional: checks both A→B and B→A pairs.
   * Resolves global KB + tenant policy to compute effective enforcement.
   */
  checkDrugInteractions(
    request: CheckDrugInteractionsRequest
  ): Promise<EngineResponse<CdsCheckResult>>;

  /**
   * Check if the proposed drug contradicts any recorded patient allergy.
   * ANAPHYLAXIS → ABSOLUTE_BLOCK, canOverride = false.
   * LIFE_THREATENING severity → ABSOLUTE_BLOCK regardless of reaction type.
   */
  checkAllergyContraindications(
    request: CheckAllergyRequest
  ): Promise<EngineResponse<CdsCheckResult>>;

  /**
   * Check protocol adherence: dose limits, age/weight/renal/hepatic/pregnancy contraindications.
   * Resolves global protocol definitions + tenant policy overrides.
   */
  checkProtocolAdherence(
    request: CheckProtocolAdherenceRequest
  ): Promise<EngineResponse<CdsCheckResult>>;

  /**
   * Aggregate all 3 sub-engine checks into a single CDS evaluation.
   * Writes one immutable record to hc_clinical_calculations with:
   *   - algorithm_id = 'CDS_SUMMARY'
   *   - input_snapshot = full patient + drug context
   *   - output = all alerts (DDI + Allergy + Protocol)
   *   - decision = PASSED | WARNED | BLOCKED | ABSOLUTE_BLOCKED
   *   - knowledge_base_version + policy_version
   *   - correlation_id + causation_id
   *
   * This is the method called by OrderEngine (prescribing gate)
   * and PharmacyEngine (dispensing gate).
   */
  generateCdsSummary(
    request: GenerateCdsSummaryRequest
  ): Promise<EngineResponse<CdsCheckResult>>;

  /** Record a new patient allergy */
  recordAllergy(request: RecordAllergyRequest): Promise<EngineResponse<PatientAllergy>>;

  /** Get all active allergies for a patient */
  getPatientAllergies(
    tenantId: string,
    patientId: string
  ): Promise<EngineResponse<PatientAllergy[]>>;

  healthCheck(): Promise<EngineHealthStatus>;
}
