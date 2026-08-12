/**
 * CarePlan Entity
 *
 * Long-term nursing care plan entity.
 *
 * @module platform/healthcare/engines/nursing-engine/domain
 */

export type CarePlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface CarePlanProps {
  id: string;
  tenantId: string;
  encounterId: string;
  admissionId?: string;
  patientPartyId: string;
  nursePractitionerId: string;
  goal: string;
  instructions: string;
  status: CarePlanStatus;
  createdAt: string;
  updatedAt: string;
}

export class CarePlan {
  private constructor(private readonly props: CarePlanProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    admissionId?: string;
    patientPartyId: string;
    nursePractitionerId: string;
    goal: string;
    instructions: string;
    now?: string;
  }): CarePlan {
    if (!input.tenantId) throw new Error('TenantId is required for CarePlan');
    if (!input.encounterId) throw new Error('EncounterId is required for CarePlan');
    if (!input.patientPartyId) throw new Error('PatientPartyId is required for CarePlan');

    const timestamp = input.now || new Date().toISOString();

    return new CarePlan({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      admissionId: input.admissionId,
      patientPartyId: input.patientPartyId,
      nursePractitionerId: input.nursePractitionerId,
      goal: input.goal,
      instructions: input.instructions,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  public static rehydrate(props: CarePlanProps): CarePlan {
    return new CarePlan(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get admissionId(): string | undefined { return this.props.admissionId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get goal(): string { return this.props.goal; }
  public get instructions(): string { return this.props.instructions; }
  public get status(): CarePlanStatus { return this.props.status; }

  public complete(now?: string): void {
    this.props.status = 'completed';
    this.props.updatedAt = now || new Date().toISOString();
  }

  public toSnapshot(): CarePlanProps {
    return { ...this.props };
  }
}
