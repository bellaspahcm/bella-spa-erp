/**
 * Real Estate Kernel — PropertyUnit Domain Entity (Aggregate Root)
 *
 * Enforces state machine invariants for property status transitions.
 *
 * State Machine transitions:
 * - AVAILABLE -> HELD (or booked) -> DEPOSITED -> CONTRACTED -> COMPLETED
 * - HELD -> AVAILABLE (expired)
 *
 * @module platform/real-estate/domain/property-unit.entity
 */

export type PropertyUnitStatus = 'available' | 'held' | 'booked' | 'deposited' | 'contracted' | 'completed';

export interface PropertyUnitProps {
  id: string;
  tenantId: string;
  projectId: string;
  productCode: string;
  productType: 'apartment' | 'townhouse' | 'shophouse' | 'villa';
  unitCode: string;
  area: number;
  unitPrice: number;
  status: PropertyUnitStatus;
  ownerName: string | null;
}

export class PropertyUnit {
  constructor(private readonly props: PropertyUnitProps) {
    if (!props.id) throw new Error('Property unit ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.projectId) throw new Error('Project ID is required');
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get projectId(): string { return this.props.projectId; }
  get productCode(): string { return this.props.productCode; }
  get productType(): 'apartment' | 'townhouse' | 'shophouse' | 'villa' { return this.props.productType; }
  get unitCode(): string { return this.props.unitCode; }
  get area(): number { return this.props.area; }
  get unitPrice(): number { return this.props.unitPrice; }
  get status(): PropertyUnitStatus { return this.props.status; }
  get ownerName(): string | null { return this.props.ownerName; }

  private assertStatus(allowed: PropertyUnitStatus[]) {
    if (!allowed.includes(this.props.status)) {
      throw new Error(
        `INVALID_STATE_TRANSITION: Cannot perform this operation. Unit is currently in '${this.props.status}' status.`
      );
    }
  }

  /**
   * Transition: AVAILABLE -> HELD (placed on hold/reservation)
   */
  reserve(customerId: string): void {
    this.assertStatus(['available']);
    this.props.status = 'held';
    this.props.ownerName = customerId;
  }

  /**
   * Transition: HELD -> AVAILABLE (released / expired hold)
   */
  release(): void {
    this.assertStatus(['held', 'booked']);
    this.props.status = 'available';
    this.props.ownerName = null;
  }

  /**
   * Transition: HELD -> DEPOSITED (deposit amount successfully paid)
   */
  depositPaid(): void {
    this.assertStatus(['held', 'booked']);
    this.props.status = 'deposited';
  }

  /**
   * Transition: DEPOSITED -> CONTRACTED (contract signed by buyer and developer)
   */
  signContract(): void {
    this.assertStatus(['deposited']);
    this.props.status = 'contracted';
  }

  /**
   * Transition: CONTRACTED -> COMPLETED (handover and final payment done)
   */
  complete(): void {
    this.assertStatus(['contracted']);
    this.props.status = 'completed';
  }

  toProps(): PropertyUnitProps {
    return { ...this.props };
  }
}
