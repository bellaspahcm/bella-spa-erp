/**
 * ICU Clinical Scoring Strategy Interface
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Strategy Pattern: Decouples scoring algorithm logic from IcuStay Aggregate
 * 
 * @module platform/healthcare/engines/icu-engine/domain/scoring
 */

export interface VitalSignsInput {
  readonly heartRate: number;
  readonly meanArterialPressure: number;
  readonly temperature: number;
  readonly respiratoryRate: number;
  readonly spo2: number;
}

export interface LabResultsInput {
  readonly pao2: number;
  readonly plateletCount: number;
  readonly bilirubin: number;
  readonly creatinine: number;
}

export interface ClinicalInput {
  readonly glasgowComaScale: number;
  readonly urineOutput: number;
  readonly vasopressorDoses?: {
    readonly dopamine?: number;
    readonly epinephrine?: number;
    readonly norepinephrine?: number;
    readonly dobutamine?: number;
  };
}

export interface ScoringInput {
  readonly vitals: VitalSignsInput;
  readonly labs: LabResultsInput;
  readonly clinical: ClinicalInput;
  readonly patientAge?: number;
  readonly hasChronicOrganFailure?: boolean;
}

export interface ScoringResult {
  readonly scoreName: string;
  readonly scoreValue: number;
  readonly severityGrade: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  readonly calculatedAt: Date;
  readonly details: Record<string, number>;
}

export interface IScoringStrategy {
  readonly name: string;
  calculateScore(input: ScoringInput): ScoringResult;
}
