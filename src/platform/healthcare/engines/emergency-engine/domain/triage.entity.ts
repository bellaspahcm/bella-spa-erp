/**
 * Triage Aggregate Root
 *
 * Manages Emergency Patient Triage, Acuity Evaluation, and Escalation Lifecycle.
 * Driven by an abstract `ITriageProtocol` strategy (e.g. ESI Protocol).
 *
 * Lifecycle States:
 * - PENDING: Initial arrival, awaiting triage nurse evaluation
 * - COMPLETED: Triage evaluated, acuity level assigned
 * - ESCALATED: Acuity escalated due to clinical deterioration during reassessment
 *
 * @module platform/healthcare/engines/emergency-engine/domain
 */

import { ITriageProtocol, AcuityAssessmentInput, AcuityLevelResult } from './protocols/triage-protocol.interface';
import { EsiTriageProtocol } from './protocols/esi-triage.protocol';

export type TriageStatus = 'PENDING' | 'COMPLETED' | 'ESCALATED';

export interface TriageProps {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string | null;
  status: TriageStatus;
  chiefComplaint: string;
  assessmentInput: AcuityAssessmentInput;
  acuityResult?: AcuityLevelResult | null;
  reassessmentCount: number;
  evaluatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Triage {
  private constructor(private readonly props: TriageProps) {}

  public static create(params: {
    id: string;
    tenantId: string;
    patientId: string;
    chiefComplaint: string;
    assessmentInput: AcuityAssessmentInput;
    evaluatedBy: string;
    protocol?: ITriageProtocol;
    encounterId?: string | null;
  }): Triage {
    if (!params.tenantId) throw new Error('Triage requires a tenantId');
    if (!params.patientId) throw new Error('Triage requires a patientId');
    if (!params.chiefComplaint.trim()) throw new Error('Triage requires a chiefComplaint');

    const protocol = params.protocol ?? new EsiTriageProtocol();
    const acuityResult = protocol.evaluate(params.assessmentInput);
    const now = new Date();

    return new Triage({
      id: params.id,
      tenantId: params.tenantId,
      patientId: params.patientId,
      encounterId: params.encounterId || null,
      status: 'COMPLETED',
      chiefComplaint: params.chiefComplaint,
      assessmentInput: params.assessmentInput,
      acuityResult,
      reassessmentCount: 0,
      evaluatedBy: params.evaluatedBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: TriageProps): Triage {
    return new Triage(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get patientId(): string { return this.props.patientId; }
  public get encounterId(): string | null | undefined { return this.props.encounterId; }
  public get status(): TriageStatus { return this.props.status; }
  public get chiefComplaint(): string { return this.props.chiefComplaint; }
  public get assessmentInput(): AcuityAssessmentInput { return this.props.assessmentInput; }
  public get acuityResult(): AcuityLevelResult | null | undefined { return this.props.acuityResult; }
  public get reassessmentCount(): number { return this.props.reassessmentCount; }
  public get evaluatedBy(): string { return this.props.evaluatedBy; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public linkEncounter(encounterId: string): void {
    if (!encounterId) throw new Error('encounterId is required');
    this.props.encounterId = encounterId;
    this.props.updatedAt = new Date();
  }

  public reassess(newInput: AcuityAssessmentInput, updatedBy: string, protocol?: ITriageProtocol): AcuityLevelResult {
    const activeProtocol = protocol ?? new EsiTriageProtocol();
    const newResult = activeProtocol.evaluate(newInput);

    const oldLevel = this.props.acuityResult?.acuityLevel ?? 5;
    if (newResult.acuityLevel < oldLevel) {
      // Numerical level is lower (e.g. from ESI 3 to ESI 1), meaning HIGHER acuity -> Escalated
      this.props.status = 'ESCALATED';
    }

    this.props.assessmentInput = newInput;
    this.props.acuityResult = newResult;
    this.props.reassessmentCount += 1;
    this.props.evaluatedBy = updatedBy;
    this.props.updatedAt = new Date();

    return newResult;
  }

  public toJSON(): TriageProps {
    return { ...this.props };
  }
}
