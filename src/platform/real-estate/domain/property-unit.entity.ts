/**
 * Real Estate Kernel — PropertyUnit Domain Entity (Aggregate Root)
 *
 * Enforces state machine invariants for property status transitions.
 *
 * State Machine transitions (aligned with Product Module):
 * - AVAILABLE -> BOOKED -> DEPOSITED -> CONTRACTED -> PAID -> HANDED_OVER
 * - BOOKED -> AVAILABLE (expired)
 * - Various states -> CANCELLED
 *
 * Note: Vocabulary aligned with Product Module (src/modules/real_estate/)
 * to ensure consistency with real_estate_products DB schema.
 *
 * @module platform/real-estate/domain/property-unit.entity
 */

export type PropertyUnitStatus = 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled';

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
   * Transition: AVAILABLE -> BOOKED (placed on hold/reservation)
   */
  reserve(customerId: string): void {
    this.assertStatus(['available']);
    this.props.status = 'booked';
    this.props.ownerName = customerId;
  }

  /**
   * Transition: BOOKED -> AVAILABLE (released / expired hold)
   */
  release(): void {
    this.assertStatus(['booked']);
    this.props.status = 'available';
    this.props.ownerName = null;
  }

  /**
   * Transition: HELD -> DEPOSITED (deposit amount successfully paid)
   */
  depositPaid(): void {
    this.assertStatus(['booked']);
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
   * Transition: CONTRACTED -> PAID (payment completed)
   */
  markPaid(): void {
    this.assertStatus(['contracted']);
    this.props.status = 'paid';
  }

  /**
   * Transition: PAID -> HANDED_OVER (handover and final completion)
   */
  complete(): void {
    this.assertStatus(['paid']);
    this.props.status = 'handed_over';
  }

  toProps(): PropertyUnitProps {
    return { ...this.props };
  }
}
