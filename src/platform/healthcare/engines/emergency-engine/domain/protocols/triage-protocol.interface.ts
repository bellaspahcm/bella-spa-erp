/**
 * Triage Protocol Interface (Acuity Strategy Abstraction)
 *
 * Defines the abstract strategy contract for Triage Acuity Assessment.
 * Allows Emergency Engine to support multiple triage protocols (ESI, Manchester, CTAS, Custom)
 * without hard-coding specific triage rules into the core domain model.
 *
 * @module platform/healthcare/engines/emergency-engine/domain/protocols
 */

export interface AcuityAssessmentInput {
  chiefComplaint: string;
  vitalSigns?: {
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    oxygenSaturation?: number;
    temperatureCelsius?: number;
    glasgowComaScale?: number;
  };
  requiresImmediateLifeSaving?: boolean;
  isHighRiskSituation?: boolean;
  isConfusedLethargicDisoriented?: boolean;
  isInSeverePainOrDistress?: boolean;
  expectedResourceCount?: number; // e.g. Labs, EKG, X-Ray, IV Fluids
}

export interface AcuityLevelResult {
  protocolName: string;
  acuityLevel: number; // e.g. 1 (Highest/Immediate) to 5 (Lowest/Non-Urgent)
  acuityCategory: string; // e.g. 'IMMEDIATE', 'EMERGENT', 'URGENT', 'LESS_URGENT', 'NON_URGENT'
  targetTimeMinutes: number; // Recommended max wait time to clinical assessment
  priorityScore: number; // Numerical priority for queue ranking
  explanation: string;
}

export interface ITriageProtocol {
  readonly name: string;
  evaluate(input: AcuityAssessmentInput): AcuityLevelResult;
}
