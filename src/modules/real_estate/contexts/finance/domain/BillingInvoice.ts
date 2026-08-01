export type InvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface BillingInvoiceProps {
  readonly id: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly installmentNumber: number;
  readonly amount: number;
  readonly dueDate: Date;
  status: InvoiceStatus;
  paidAt?: Date;
  transactionReference?: string;
}

export class BillingInvoice {
  constructor(private readonly props: BillingInvoiceProps) {
    if (!props.id) throw new Error('Invoice ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.contractId) throw new Error('Contract ID is required');
    if (props.amount <= 0) throw new Error('Invoice amount must be greater than zero');
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get contractId(): string {
    return this.props.contractId;
  }

  public get installmentNumber(): number {
    return this.props.installmentNumber;
  }

  public get amount(): number {
    return this.props.amount;
  }

  public get dueDate(): Date {
    return this.props.dueDate;
  }

  public get status(): InvoiceStatus {
    return this.props.status;
  }

  public get paidAt(): Date | undefined {
    return this.props.paidAt;
  }

  public get transactionReference(): string | undefined {
    return this.props.transactionReference;
  }

  /**
   * Check and flag overdue invoice based on current date
   */
  public checkOverdue(currentDate: Date): void {
    if (this.props.status === 'UNPAID' && currentDate > this.props.dueDate) {
      this.props.status = 'OVERDUE';
    }
  }

  /**
   * Mark the invoice as paid from matched treasury cash receipt
   */
  public markPaid(transactionReference: string, paidAt: Date): void {
    if (this.props.status === 'PAID') {
      throw new Error('Invoice is already paid');
    }
    this.props.status = 'PAID';
    this.props.paidAt = paidAt;
    this.props.transactionReference = transactionReference;
  }
}
