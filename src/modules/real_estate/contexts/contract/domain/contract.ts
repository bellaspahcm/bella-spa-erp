export type ContractStatus = 'draft' | 'signed' | 'cancelled';

export interface ContractProperties {
  id: string;
  tenantId: string;
  projectId: string;
  apartmentId: string;
  customerName: string;
  totalValue: number;
  signedDate?: string;
  status: ContractStatus;
}

export class ContractDomainModel {
  constructor(private props: ContractProperties) {}

  get properties(): ContractProperties {
    return { ...this.props };
  }

  sign(date: string): void {
    if (this.props.status !== 'draft') {
      throw new Error(`Cannot sign contract ${this.props.id} in status ${this.props.status}`);
    }
    this.props.status = 'signed';
    this.props.signedDate = date;
  }

  cancel(): void {
    if (this.props.status === 'signed') {
      throw new Error(`Cannot cancel a signed contract ${this.props.id}`);
    }
    this.props.status = 'cancelled';
  }
}
