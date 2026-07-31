import { InstallmentDomainModel } from '../../domain/payment';

export interface CollectPaymentInput {
  installment: InstallmentDomainModel;
  amount: number;
}

export class CollectPaymentCommandHandler {
  static handle(input: CollectPaymentInput): void {
    input.installment.collectPayment(input.amount);
  }
}
