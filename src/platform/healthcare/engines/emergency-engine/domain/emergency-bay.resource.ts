/**
 * EmergencyBay Resource Aggregate (Resource Allocation Capability)
 *
 * Manages Emergency Room Bay / Treatment Slot allocation & concurrency defense.
 *
 * Architecture Invariant:
 * EmergencyBay is a Resource Aggregate / Capability (NOT a clinical record aggregate).
 * It provides Concurrency Defense for treatment slots / bays in Emergency Department,
 * establishing the pattern for future resource allocations.
 *
 * Lifecycle States:
 * - AVAILABLE: Ready for immediate patient allocation
 * - OCCUPIED: Currently allocated to an emergency encounter
 * - MAINTENANCE: Under cleaning or technical maintenance
 *
 * @module platform/healthcare/engines/emergency-engine/domain
 */

export type EmergencyBayStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface EmergencyBayProps {
  id: string;
  tenantId: string;
  bayCode: string;
  bayName: string;
  status: EmergencyBayStatus;
  currentEncounterId?: string | null;
  currentPatientId?: string | null;
  allocatedAt?: Date | null;
  version: number; // Optimistic locking version
  createdAt: Date;
  updatedAt: Date;
}

export class EmergencyBay {
  private constructor(private readonly props: EmergencyBayProps) {}

  public static create(params: {
    id: string;
    tenantId: string;
    bayCode: string;
    bayName: string;
  }): EmergencyBay {
    if (!params.tenantId) throw new Error('EmergencyBay requires tenantId');
    if (!params.bayCode.trim()) throw new Error('EmergencyBay requires bayCode');
    if (!params.bayName.trim()) throw new Error('EmergencyBay requires bayName');

    const now = new Date();

    return new EmergencyBay({
      id: params.id,
      tenantId: params.tenantId,
      bayCode: params.bayCode,
      bayName: params.bayName,
      status: 'AVAILABLE',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: EmergencyBayProps): EmergencyBay {
    return new EmergencyBay(props);
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get bayCode(): string { return this.props.bayCode; }
  public get bayName(): string { return this.props.bayName; }
  public get status(): EmergencyBayStatus { return this.props.status; }
  public get currentEncounterId(): string | null | undefined { return this.props.currentEncounterId; }
  public get currentPatientId(): string | null | undefined { return this.props.currentPatientId; }
  public get allocatedAt(): Date | null | undefined { return this.props.allocatedAt; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public canAllocate(): boolean {
    return this.props.status === 'AVAILABLE';
  }

  public allocate(encounterId: string, patientId: string): void {
    if (this.props.status !== 'AVAILABLE') {
      throw new Error(`Cannot allocate EmergencyBay ${this.props.bayCode}: current status is ${this.props.status}`);
    }
    if (!encounterId) throw new Error('Allocation requires encounterId');
    if (!patientId) throw new Error('Allocation requires patientId');

    this.props.status = 'OCCUPIED';
    this.props.currentEncounterId = encounterId;
    this.props.currentPatientId = patientId;
    this.props.allocatedAt = new Date();
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public release(): void {
    if (this.props.status !== 'OCCUPIED') {
      throw new Error(`Cannot release EmergencyBay ${this.props.bayCode}: current status is ${this.props.status}`);
    }

    this.props.status = 'AVAILABLE';
    this.props.currentEncounterId = null;
    this.props.currentPatientId = null;
    this.props.allocatedAt = null;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public setMaintenance(): void {
    if (this.props.status === 'OCCUPIED') {
      throw new Error(`Cannot set EmergencyBay ${this.props.bayCode} to maintenance while OCCUPIED`);
    }

    this.props.status = 'MAINTENANCE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public toJSON(): EmergencyBayProps {
    return { ...this.props };
  }
}
