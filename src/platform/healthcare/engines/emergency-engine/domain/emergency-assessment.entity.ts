/**
 * EmergencyAssessment Aggregate Root
 *
 * Manages Emergency Clinical Initial Assessment (Primary & Secondary Surveys)
 * and Rapid Reassessment Cycles.
 *
 * Lifecycle States:
 * - INITIAL_IN_PROGRESS: Assessment initiated by emergency physician
 * - COMPLETED: Assessment finalized
 * - REASSESSING: Rapid reassessment cycle active
 *
 * @module platform/healthcare/engines/emergency-engine/domain
 */

export type EmergencyAssessmentStatus = 'INITIAL_IN_PROGRESS' | 'COMPLETED' | 'REASSESSING';

export interface PrimarySurvey {
  airwayPatent: boolean;
  breathingAdequate: boolean;
  circulationPulsePresent: boolean;
  disabilityGcs: number; // Glasgow Coma Scale (3-15)
  exposureTemperature: number;
}

export interface ClinicalVitals {
  heartRate: number;
  respiratoryRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  temperatureCelsius: number;
  recordedAt: Date;
}

export interface RapidReassessmentNote {
  reassessmentId: string;
  reassessedAt: Date;
  clinicianId: string;
  findingsNote: string;
  vitalSigns?: ClinicalVitals;
  conditionStatus: 'STABLE' | 'IMPROVED' | 'DETERIORATED';
}

export interface EmergencyAssessmentProps {
  id: string;
  tenantId: string;
  encounterId: string;
  triageId: string;
  status: EmergencyAssessmentStatus;
  primarySurvey: PrimarySurvey;
  secondarySurveyNote: string;
  vitals: ClinicalVitals;
  reassessmentNotes: RapidReassessmentNote[];
  assessedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmergencyAssessment {
  private constructor(private readonly props: EmergencyAssessmentProps) {}

  public static create(params: {
    id: string;
    tenantId: string;
    encounterId: string;
    triageId: string;
    primarySurvey: PrimarySurvey;
    secondarySurveyNote: string;
    vitals: ClinicalVitals;
    assessedBy: string;
  }): EmergencyAssessment {
    if (!params.tenantId) throw new Error('EmergencyAssessment requires tenantId');
    if (!params.encounterId) throw new Error('EmergencyAssessment requires encounterId');
    if (!params.triageId) throw new Error('EmergencyAssessment requires triageId');
    if (!params.assessedBy) throw new Error('EmergencyAssessment requires assessedBy');

    const now = new Date();

    return new EmergencyAssessment({
      id: params.id,
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      triageId: params.triageId,
      status: 'INITIAL_IN_PROGRESS',
      primarySurvey: params.primarySurvey,
      secondarySurveyNote: params.secondarySurveyNote,
      vitals: params.vitals,
      reassessmentNotes: [],
      assessedBy: params.assessedBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: EmergencyAssessmentProps): EmergencyAssessment {
    return new EmergencyAssessment(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get triageId(): string { return this.props.triageId; }
  public get status(): EmergencyAssessmentStatus { return this.props.status; }
  public get primarySurvey(): PrimarySurvey { return this.props.primarySurvey; }
  public get secondarySurveyNote(): string { return this.props.secondarySurveyNote; }
  public get vitals(): ClinicalVitals { return this.props.vitals; }
  public get reassessmentNotes(): ReadonlyArray<RapidReassessmentNote> { return this.props.reassessmentNotes; }
  public get assessedBy(): string { return this.props.assessedBy; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public completeAssessment(): void {
    if (this.props.status === 'COMPLETED') throw new Error('Assessment is already completed');
    this.props.status = 'COMPLETED';
    this.props.updatedAt = new Date();
  }

  public addRapidReassessment(params: {
    reassessmentId: string;
    clinicianId: string;
    findingsNote: string;
    conditionStatus: 'STABLE' | 'IMPROVED' | 'DETERIORATED';
    vitalSigns?: ClinicalVitals;
  }): void {
    if (!params.findingsNote.trim()) throw new Error('Rapid reassessment requires findingsNote');

    const note: RapidReassessmentNote = {
      reassessmentId: params.reassessmentId,
      reassessedAt: new Date(),
      clinicianId: params.clinicianId,
      findingsNote: params.findingsNote,
      vitalSigns: params.vitalSigns,
      conditionStatus: params.conditionStatus,
    };

    this.props.reassessmentNotes.push(note);
    this.props.status = 'REASSESSING';
    if (params.vitalSigns) {
      this.props.vitals = params.vitalSigns;
    }
    this.props.updatedAt = new Date();
  }

  public toJSON(): EmergencyAssessmentProps {
    return {
      ...this.props,
      reassessmentNotes: [...this.props.reassessmentNotes],
    };
  }
}
