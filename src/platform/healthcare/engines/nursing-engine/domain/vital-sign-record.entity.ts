/**
 * VitalSignRecord Entity
 *
 * Immutable clinical measurement record representing a patient's vital signs.
 * Linked via tenantId, encounterId, admissionId, patientPartyId.
 *
 * @module platform/healthcare/engines/nursing-engine/domain
 */

export interface VitalSignRecordProps {
  id: string;
  tenantId: string;
  encounterId: string;
  admissionId?: string;
  patientPartyId: string;
  nursePractitionerId: string;
  temperature: number; // Celsius (e.g. 37.0)
  heartRate: number; // bpm
  systolicBp: number; // mmHg
  diastolicBp: number; // mmHg
  spo2: number; // % (e.g. 98)
  respiratoryRate?: number; // breaths/min
  notes?: string;
  recordedAt: string;
}

export class VitalSignRecord {
  private constructor(private readonly props: VitalSignRecordProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    encounterId: string;
    admissionId?: string;
    patientPartyId: string;
    nursePractitionerId: string;
    temperature: number;
    heartRate: number;
    systolicBp: number;
    diastolicBp: number;
    spo2: number;
    respiratoryRate?: number;
    notes?: string;
    now?: string;
  }): VitalSignRecord {
    if (!input.tenantId) throw new Error('TenantId is required for VitalSignRecord');
    if (!input.encounterId) throw new Error('EncounterId is required for VitalSignRecord');
    if (!input.patientPartyId) throw new Error('PatientPartyId is required for VitalSignRecord');
    if (!input.nursePractitionerId) throw new Error('NursePractitionerId is required for VitalSignRecord');

    if (input.temperature < 25 || input.temperature > 45) {
      throw new Error(`Invalid body temperature value: ${input.temperature}°C`);
    }
    if (input.heartRate < 20 || input.heartRate > 300) {
      throw new Error(`Invalid heart rate value: ${input.heartRate} bpm`);
    }
    if (input.systolicBp < 30 || input.systolicBp > 300) {
      throw new Error(`Invalid systolic blood pressure: ${input.systolicBp} mmHg`);
    }

    const timestamp = input.now || new Date().toISOString();

    return new VitalSignRecord({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      admissionId: input.admissionId,
      patientPartyId: input.patientPartyId,
      nursePractitionerId: input.nursePractitionerId,
      temperature: input.temperature,
      heartRate: input.heartRate,
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      spo2: input.spo2,
      respiratoryRate: input.respiratoryRate,
      notes: input.notes,
      recordedAt: timestamp,
    });
  }

  public static rehydrate(props: VitalSignRecordProps): VitalSignRecord {
    return new VitalSignRecord(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get admissionId(): string | undefined { return this.props.admissionId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get nursePractitionerId(): string { return this.props.nursePractitionerId; }
  public get temperature(): number { return this.props.temperature; }
  public get heartRate(): number { return this.props.heartRate; }
  public get systolicBp(): number { return this.props.systolicBp; }
  public get diastolicBp(): number { return this.props.diastolicBp; }
  public get spo2(): number { return this.props.spo2; }
  public get respiratoryRate(): number | undefined { return this.props.respiratoryRate; }
  public get notes(): string | undefined { return this.props.notes; }
  public get recordedAt(): string { return this.props.recordedAt; }

  public toSnapshot(): VitalSignRecordProps {
    return { ...this.props };
  }
}
