export type ApartmentStatus = 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled';

export interface ApartmentProperties {
  id: string;
  projectId: string;
  unitCode: string;
  floor: number;
  block: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  price: number;
  status: ApartmentStatus;
  ownerName?: string | null;
}

export class ApartmentDomainModel {
  constructor(private props: ApartmentProperties) {}

  get properties(): ApartmentProperties {
    return { ...this.props };
  }

  canTransitionTo(targetStatus: ApartmentStatus): boolean {
    const current = this.props.status;
    if (current === targetStatus) return true;

    const VALID_TRANSITIONS: Record<ApartmentStatus, ApartmentStatus[]> = {
      available: ['booked', 'deposited', 'cancelled'],
      booked: ['available', 'deposited', 'cancelled'],
      deposited: ['contracted', 'cancelled'],
      contracted: ['paid', 'cancelled'],
      paid: ['handed_over', 'cancelled'],
      handed_over: [],
      cancelled: ['available']
    };

    const allowed = VALID_TRANSITIONS[current] || [];
    return allowed.includes(targetStatus);
  }

  transitionTo(targetStatus: ApartmentStatus, ownerName?: string | null): void {
    if (!this.canTransitionTo(targetStatus)) {
      throw new Error(`Không thể chuyển đổi trạng thái căn hộ ${this.props.unitCode} từ ${this.props.status} sang ${targetStatus}`);
    }
    this.props.status = targetStatus;
    if (ownerName !== undefined) {
      this.props.ownerName = ownerName;
    }
  }
}
