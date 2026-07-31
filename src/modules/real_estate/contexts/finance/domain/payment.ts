export type PaymentStatus = 'unpaid' | 'partially_paid' | 'fully_paid';

export interface InstallmentProperties {
  id: string;
  contractId: string;
  installmentNumber: number;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
}

export class InstallmentDomainModel {
  constructor(private props: InstallmentProperties) {}

  get properties(): InstallmentProperties {
    return { ...this.props };
  }

  collectPayment(amount: number): void {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    const newPaid = this.props.amountPaid + amount;
    if (newPaid > this.props.amountDue) {
      throw new Error('Payment exceeds amount due for this installment');
    }

    this.props.amountPaid = newPaid;
    if (newPaid === this.props.amountDue) {
      this.props.status = 'fully_paid';
    } else {
      this.props.status = 'partially_paid';
    }
  }
}
