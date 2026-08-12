/**
 * NursingAssessment Entity
 *
 * Clinical assessment entity capturing patient risk (fall risk, pain scale, Glasgow consciousness).
 *
 * @module platform/healthcare/engines/nursing-engine/domain
 */

export type FallRiskLevel = 'low' | 'moderate' | 'high';

export interface NursingAssessmentProps {
  id: string;
  tenantId: string;
  encounterId: string;
  admissionId?: string;
  patientPartyId: string;
  nursePractitionerId: string;
  painScale: number; // 0-10
  fallRiskLevel: FallRiskLevel;
  glasgowComaScale: number; // 3-15
  assessmentNotes: string;
  assessedAt: string;
}

export class NursingAssessment {
  private constructor(private readonly props: NursingAssessmentProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    admissionId?: string;
    patientPartyId: string;
    nursePractitionerId: string;
    painScale: number;
    fallRiskLevel: FallRiskLevel;
    glasgowComaScale: number;
    assessmentNotes: string;
    now?: string;
  }): NursingAssessment {
    if (!input.tenantId) throw new Error('TenantId is required for NursingAssessment');
    if (!input.encounterId) throw new Error('EncounterId is required for NursingAssessment');
    if (!input.patientPartyId) throw new Error('PatientPartyId is required for NursingAssessment');
    if (input.painScale < 0 || input.painScale > 10) {
      throw new Error(`Invalid pain scale value: ${input.painScale} (must be 0-10)`);
    }
    if (input.glasgowComaScale < 3 || input.glasgowComaScale > 15) {
      throw new Error(`Invalid Glasgow Coma Scale: ${input.glasgowComaScale} (must be 3-15)`);
    }

    const timestamp = input.now || new Date().toISOString();

    return new NursingAssessment({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      admissionId: input.admissionId,
      patientPartyId: input.patientPartyId,
      nursePractitionerId: input.nursePractitionerId,
      painScale: input.painScale,
      fallRiskLevel: input.fallRiskLevel,
      glasgowComaScale: input.glasgowComaScale,
      assessmentNotes: input.assessmentNotes,
      assessedAt: timestamp,
    });
  }

  public static rehydrate(props: NursingAssessmentProps): NursingAssessment {
    return new NursingAssessment(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get admissionId(): string | undefined { return this.props.admissionId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get nursePractitionerId(): string { return this.props.nursePractitionerId; }
  public get painScale(): number { return this.props.painScale; }
  public get fallRiskLevel(): FallRiskLevel { return this.props.fallRiskLevel; }
  public get glasgowComaScale(): number { return this.props.glasgowComaScale; }
  public get assessmentNotes(): string { return this.props.assessmentNotes; }
  public get assessedAt(): string { return this.props.assessedAt; }

  public toSnapshot(): NursingAssessmentProps {
    return { ...this.props };
  }
}
