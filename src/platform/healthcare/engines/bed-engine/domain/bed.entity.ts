/**
 * Bed Aggregate Root & BedOccupancy Value Object
 *
 * Domain Entity representing a Hospital Bed in the Healthcare Platform.
 *
 * Invariants:
 * - 1 Bed MUST have at most ONE active occupancy at any point in time.
 * - Attempting to allocate an already occupied, reserved, or maintenance bed MUST throw a domain invariant exception.
 * - Bed transfer creates a new occupancy on the target bed while releasing the source bed to 'cleaning' or 'available'.
 *
 * @module platform/healthcare/engines/bed-engine/domain
 */

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
export type BedType = 'standard' | 'vip' | 'icu' | 'isolation' | 'pediatric' | 'regular';

export interface BedOccupancyProps {
  admissionId: string;
  patientPartyId: string;
  encounterId: string;
  assignedAt: string;
}

export class BedOccupancy {
  constructor(private readonly props: BedOccupancyProps) {}

  public get admissionId(): string { return this.props.admissionId; }
  public get patientPartyId(): string { return this.props.patientPartyId; }
  public get encounterId(): string { return this.props.encounterId; }
  public get assignedAt(): string { return this.props.assignedAt; }

  public toSnapshot(): BedOccupancyProps {
    return { ...this.props };
  }
}

export interface BedStateProps {
  id: string;
  tenantId: string;
  wardId: string;
  bedCode: string;
  bedType: BedType;
  status: BedStatus;
  dailyRate: number;
  occupancy?: BedOccupancy;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class Bed {
  private constructor(private readonly props: BedStateProps) {}

  public static create(input: {
    id: string;
    tenantId: string;
    wardId: string;
    bedCode: string;
    bedType: BedType;
    dailyRate: number;
    now?: string;
  }): Bed {
    if (!input.tenantId) throw new Error('TenantId is required for Bed');
    if (!input.wardId) throw new Error('WardId is required for Bed');
    if (!input.bedCode) throw new Error('BedCode is required for Bed');

    const timestamp = input.now || new Date().toISOString();

    return new Bed({
      id: input.id,
      tenantId: input.tenantId,
      wardId: input.wardId,
      bedCode: input.bedCode,
      bedType: input.bedType,
      status: 'available',
      dailyRate: input.dailyRate,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  public static rehydrate(props: BedStateProps): Bed {
    return new Bed(props);
  }

  // Getters
  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get wardId(): string { return this.props.wardId; }
  public get bedCode(): string { return this.props.bedCode; }
  public get bedType(): BedType { return this.props.bedType; }
  public get status(): BedStatus { return this.props.status; }
  public get dailyRate(): number { return this.props.dailyRate; }
  public get occupancy(): BedOccupancy | undefined { return this.props.occupancy; }
  public get version(): number { return this.props.version; }

  // State Invariants & Methods
  public allocate(input: {
    admissionId: string;
    patientPartyId: string;
    encounterId: string;
    now?: string;
  }): void {
    if (this.props.status !== 'available') {
      throw new Error(`Bed ${this.props.bedCode} (${this.props.id}) is not available for allocation. Current status: ${this.props.status}`);
    }
    if (this.props.occupancy) {
      throw new Error(`Bed ${this.props.bedCode} (${this.props.id}) already has an active occupancy`);
    }

    const timestamp = input.now || new Date().toISOString();
    this.props.status = 'occupied';
    this.props.occupancy = new BedOccupancy({
      admissionId: input.admissionId,
      patientPartyId: input.patientPartyId,
      encounterId: input.encounterId,
      assignedAt: timestamp,
    });
    this.props.version += 1;
    this.props.updatedAt = timestamp;
  }

  public release(reason: 'discharge' | 'transfer' | 'manual', now?: string): void {
    if (this.props.status !== 'occupied') {
      throw new Error(`Bed ${this.props.bedCode} (${this.props.id}) is not occupied. Current status: ${this.props.status}`);
    }

    const timestamp = now || new Date().toISOString();
    this.props.occupancy = undefined;
    this.props.status = reason === 'discharge' || reason === 'transfer' ? 'cleaning' : 'available';
    this.props.version += 1;
    this.props.updatedAt = timestamp;
  }

  public markCleaned(now?: string): void {
    if (this.props.status !== 'cleaning') {
      throw new Error(`Bed ${this.props.bedCode} is not in cleaning status`);
    }
    const timestamp = now || new Date().toISOString();
    this.props.status = 'available';
    this.props.version += 1;
    this.props.updatedAt = timestamp;
  }

  public toSnapshot(): BedStateProps {
    return {
      ...this.props,
      occupancy: this.props.occupancy ? this.props.occupancy : undefined,
    };
  }
}
