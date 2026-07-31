import { InstallmentDomainModel } from '../domain/payment';
import { CollectPaymentCommandHandler } from '../application/commands/collect-payment-command';

describe('Finance Bounded Context', () => {
  it('should collect payment partially and fully', () => {
    const installment = new InstallmentDomainModel({
      id: 'inst-1',
      contractId: 'ctr-123',
      installmentNumber: 1,
      amountDue: 500000000,
      amountPaid: 0,
      status: 'unpaid',
    });

    // 1. Partial payment
    CollectPaymentCommandHandler.handle({
      installment,
      amount: 200000000,
    });
    expect(installment.properties.amountPaid).toBe(200000000);
    expect(installment.properties.status).toBe('partially_paid');

    // 2. Full payment
    CollectPaymentCommandHandler.handle({
      installment,
      amount: 300000000,
    });
    expect(installment.properties.amountPaid).toBe(500000000);
    expect(installment.properties.status).toBe('fully_paid');
  });

  it('should throw an error if payment exceeds amount due', () => {
    const installment = new InstallmentDomainModel({
      id: 'inst-2',
      contractId: 'ctr-123',
      installmentNumber: 2,
      amountDue: 500000000,
      amountPaid: 400000000,
      status: 'partially_paid',
    });

    expect(() => {
      CollectPaymentCommandHandler.handle({
        installment,
        amount: 200000000,
      });
    }).toThrow('Payment exceeds amount due for this installment');
  });
});
