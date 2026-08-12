/**
 * CareTask Entity
 *
 * Granular nursing task (e.g. dressing change, hygiene care, positioning).
 *
 * @module platform/healthcare/engines/nursing-engine/domain
 */

export type CareTaskStatus = 'pending' | 'completed' | 'cancelled';

export interface CareTaskProps {
  id: string;
  tenantId: string;
  encounterId: string;
  admissionId?: string;
  patientPartyId: string;
  carePlanId?: string;
  nursePractitionerId?: string;
  title: string;
  description: string;
  scheduledTime: string;
  completedTime?: string;
  status: CareTaskStatus;
}

export class CareTask {
  private constructor(private readonly props: CareTaskProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    admissionId?: string;
    patientPartyId: string;
    carePlanId?: string;
    title: string;
    description: string;
    scheduledTime: string;
  }): CareTask {
    if (!input.tenantId) throw new Error('TenantId is required for CareTask');
    if (!input.encounterId) throw new Error('EncounterId is required for CareTask');
    if (!input.patientPartyId) throw new Error('PatientPartyId is required for CareTask');

    return new CareTask({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      admissionId: input.admissionId,
      patientPartyId: input.patientPartyId,
      carePlanId: input.carePlanId,
      title: input.title,
      description: input.description,
      scheduledTime: input.scheduledTime,
      status: 'pending',
    });
  }

  public static rehydrate(props: CareTaskProps): CareTask {
    return new CareTask(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get admissionId(): string | undefined { return this.props.admissionId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get carePlanId(): string | undefined { return this.props.carePlanId; }
  public get title(): string { return this.props.title; }
  public get description(): string { return this.props.description; }
  public get scheduledTime(): string { return this.props.scheduledTime; }
  public get completedTime(): string | undefined { return this.props.completedTime; }
  public get status(): CareTaskStatus { return this.props.status; }

  public complete(nurseId: string, now?: string): void {
    if (this.props.status === 'completed') {
      throw new Error('CareTask is already completed');
    }
    this.props.status = 'completed';
    this.props.nursePractitionerId = nurseId;
    this.props.completedTime = now || new Date().toISOString();
  }

  public toSnapshot(): CareTaskProps {
    return { ...this.props };
  }
}
