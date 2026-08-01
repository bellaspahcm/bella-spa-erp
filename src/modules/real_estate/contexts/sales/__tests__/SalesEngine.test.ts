import { BookingAggregate } from '../domain/BookingAggregate';
import { DepositAggregate } from '../domain/DepositAggregate';
import { ContractAggregate } from '../domain/ContractAggregate';
import { TransitionContext } from '@/platform/state-machine/state-machine';

describe('Sales Bounded Context', () => {
  const tenantId = 'tenant-abc';
  const customerId = 'cust-123';
  const productId = 'prod-456';

  const mockContext: TransitionContext = {
    tenantId,
    correlationId: 'corr-100',
    actor: { userId: 'agent-1' },
  };

  describe('BookingAggregate', () => {
    it('should create and execute FSM transition from draft to pending to confirmed', async () => {
      const booking = new BookingAggregate({
        id: 'book-1',
        tenantId,
        productId,
        customerId,
        bookingFee: 50000000,
        state: 'DRAFT',
      });

      expect(booking.state).toBe('DRAFT');

      await booking.transition('SUBMIT', mockContext);
      expect(booking.state).toBe('PENDING_APPROVAL');

      await booking.transition('CONFIRM', mockContext);
      expect(booking.state).toBe('CONFIRMED');
    });
  });

  describe('DepositAggregate', () => {
    it('should create and transition to paid status', async () => {
      const deposit = new DepositAggregate({
        id: 'dep-1',
        tenantId,
        productId,
        customerId,
        depositAmount: 100000000,
        state: 'DRAFT',
      });

      expect(deposit.state).toBe('DRAFT');

      await deposit.transition('PAY', mockContext);
      expect(deposit.state).toBe('PAID');
    });
  });

  describe('ContractAggregate', () => {
    it('should calculate and generate payment schedules', () => {
      const contract = new ContractAggregate({
        id: 'con-1',
        tenantId,
        productId,
        customerId,
        contractPrice: 3000000000, // 3B
        state: 'DRAFT',
        installments: [],
      });

      const startDate = new Date(2026, 7, 1); // Aug 1, 2026
      contract.generatePaymentSchedule(5, startDate);

      const schedule = contract.installments;
      expect(schedule.length).toBe(5);
      expect(schedule[0].amount).toBe(600000000); // 600M each
      expect(schedule[4].amount).toBe(600000000);
      expect(schedule[0].dueDate.getMonth()).toBe(7); // Aug
      expect(schedule[4].dueDate.getMonth()).toBe(11); // Dec
    });

    it('should transition contract state', async () => {
      const contract = new ContractAggregate({
        id: 'con-1',
        tenantId,
        productId,
        customerId,
        contractPrice: 3000000000,
        state: 'DRAFT',
        installments: [],
      });

      await contract.transition('SUBMIT', mockContext);
      expect(contract.state).toBe('PENDING_APPROVAL');

      await contract.transition('ACTIVATE', mockContext);
      expect(contract.state).toBe('ACTIVE');
    });
  });
});
