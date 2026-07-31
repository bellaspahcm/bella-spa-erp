export type ReservationStatus = 'pending_deposit' | 'deposited' | 'converted_to_contract' | 'cancelled';

export interface ReservationProperties {
  id: string;
  apartmentId: string;
  customerName: string;
  customerPhone: string;
  depositAmount: number;
  status: ReservationStatus;
  createdAt: string;
}

export class ReservationDomainModel {
  constructor(private props: ReservationProperties) {}

  get properties(): ReservationProperties {
    return { ...this.props };
  }

  confirmDeposit(): void {
    if (this.props.status !== 'pending_deposit') {
      throw new Error(`Cannot confirm deposit for reservation ${this.props.id} in status ${this.props.status}`);
    }
    this.props.status = 'deposited';
  }

  cancel(): void {
    if (this.props.status === 'converted_to_contract') {
      throw new Error(`Cannot cancel reservation ${this.props.id} that is already converted to contract`);
    }
    this.props.status = 'cancelled';
  }
}
