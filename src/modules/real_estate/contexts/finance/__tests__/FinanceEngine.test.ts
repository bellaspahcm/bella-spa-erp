import { BillingInvoice } from '../domain/BillingInvoice';
import { TreasuryMatcher, BankTransaction } from '../application/TreasuryMatcher';
import { RevenueRecognition } from '../domain/RevenueRecognition';
import { BudgetGuard } from '../domain/BudgetGuard';

describe('Finance Context - Billing & Treasury', () => {
  const tenantId = 'tenant-abc';
  const contractId = 'con-100';

  describe('BillingInvoice', () => {
    it('should create invoice and track overdue status', () => {
      const invoice = new BillingInvoice({
        id: 'inv-1',
        tenantId,
        contractId,
        installmentNumber: 1,
        amount: 200000000, // 200M
        dueDate: new Date(2026, 7, 10), // Aug 10, 2026
        status: 'UNPAID',
      });

      expect(invoice.status).toBe('UNPAID');

      // Check overdue before date -> remains unpaid
      invoice.checkOverdue(new Date(2026, 7, 5));
      expect(invoice.status).toBe('UNPAID');

      // Check overdue after date -> becomes overdue
      invoice.checkOverdue(new Date(2026, 7, 15));
      expect(invoice.status).toBe('OVERDUE');
    });

    it('should mark invoice as paid', () => {
      const invoice = new BillingInvoice({
        id: 'inv-1',
        tenantId,
        contractId,
        installmentNumber: 1,
        amount: 200000000,
        dueDate: new Date(2026, 7, 10),
        status: 'UNPAID',
      });

      const paidDate = new Date();
      invoice.markPaid('tx-ref-999', paidDate);

      expect(invoice.status).toBe('PAID');
      expect(invoice.transactionReference).toBe('tx-ref-999');
      expect(invoice.paidAt).toEqual(paidDate);
    });

    it('should prevent marking already paid invoice', () => {
      const invoice = new BillingInvoice({
        id: 'inv-1',
        tenantId,
        contractId,
        installmentNumber: 1,
        amount: 200000000,
        dueDate: new Date(2026, 7, 10),
        status: 'PAID',
      });

      expect(() => {
        invoice.markPaid('tx-ref-999', new Date());
      }).toThrow('Invoice is already paid');
    });
  });

  describe('TreasuryMatcher', () => {
    const matcher = new TreasuryMatcher();

    it('should successfully match bank transaction using transfer description keywords', () => {
      const openInvoices = [
        new BillingInvoice({
          id: 'inv-1',
          tenantId,
          contractId,
          installmentNumber: 2,
          amount: 150000000,
          dueDate: new Date(2026, 8, 10),
          status: 'UNPAID',
        }),
      ];

      const bankTx: BankTransaction = {
        id: 'bank-tx-888',
        amount: 150000000,
        description: 'Thanh toan dot 2 hop dong CON-100',
        transactionDate: new Date(),
      };

      const result = matcher.matchTransaction(bankTx, openInvoices);

      expect(result.matched).toBe(true);
      expect(result.invoiceId).toBe('inv-1');
      expect(result.contractId).toBe(contractId);
      expect(openInvoices[0].status).toBe('PAID');
      expect(openInvoices[0].transactionReference).toBe('bank-tx-888');
    });

    it('should fail to match if transfer description contains no contract ID', () => {
      const openInvoices = [
        new BillingInvoice({
          id: 'inv-1',
          tenantId,
          contractId,
          installmentNumber: 1,
          amount: 150000000,
          dueDate: new Date(),
          status: 'UNPAID',
        }),
      ];

      const bankTx: BankTransaction = {
        id: 'bank-tx-888',
        amount: 150000000,
        description: 'Chuyen tien mua nha dot 1',
        transactionDate: new Date(),
      };

      const result = matcher.matchTransaction(bankTx, openInvoices);

      expect(result.matched).toBe(false);
      expect(result.error).toBe('No contract code found in description');
    });

    it('should fail to match if amount differs', () => {
      const openInvoices = [
        new BillingInvoice({
          id: 'inv-1',
          tenantId,
          contractId,
          installmentNumber: 1,
          amount: 150000000,
          dueDate: new Date(),
          status: 'UNPAID',
        }),
      ];

      const bankTx: BankTransaction = {
        id: 'bank-tx-888',
        amount: 140000000, // differing amount
        description: 'Thanh toan dot 1 hop dong CON-100',
        transactionDate: new Date(),
      };

      const result = matcher.matchTransaction(bankTx, openInvoices);

      expect(result.matched).toBe(false);
      expect(result.error).toContain('No unpaid invoice found matching contract "con-100"');
    });
  });

  describe('RevenueRecognition', () => {
    it('should recognize revenue incrementally based on completion percentage', () => {
      const rev = new RevenueRecognition({
        id: 'rev-1',
        tenantId,
        contractId,
        totalContractPrice: 3000000000, // 3B
        recognizedAmount: 0,
        recognizedPercentage: 0,
        method: 'percentage_of_completion',
      });

      // 30% construction completion -> recognize 900M
      const inc1 = rev.recognizeRevenue(30);
      expect(inc1).toBe(900000000);
      expect(rev.recognizedAmount).toBe(900000000);

      // 50% construction completion -> recognize another 600M (total 1.5B)
      const inc2 = rev.recognizeRevenue(50);
      expect(inc2).toBe(600000000);
      expect(rev.recognizedAmount).toBe(1500000000);
    });

    it('should recognize full revenue on handover', () => {
      const rev = new RevenueRecognition({
        id: 'rev-2',
        tenantId,
        contractId,
        totalContractPrice: 3000000000,
        recognizedAmount: 0,
        recognizedPercentage: 0,
        method: 'handover',
      });

      const inc = rev.recognizeFullHandover();
      expect(inc).toBe(3000000000);
      expect(rev.recognizedPercentage).toBe(100);
    });
  });

  describe('BudgetGuard', () => {
    it('should verify and record expenses within the cap limit', () => {
      const guard = new BudgetGuard({
        projectId: 'project-1',
        category: 'marketing',
        allocatedCap: 1000000000, // 1B
        spentAmount: 800000000, // 800M spent
      });

      // proposed expense: 150M -> within cap (950M total)
      expect(() => guard.verifyExpense(150000000)).not.toThrow();

      // record expense
      guard.recordExpense(150000000);
      expect(guard.spentAmount).toBe(950000000);
    });

    it('should throw error when proposed expense exceeds cap limit', () => {
      const guard = new BudgetGuard({
        projectId: 'project-1',
        category: 'marketing',
        allocatedCap: 1000000000,
        spentAmount: 900000000,
      });

      // proposed: 150M -> exceeds cap by 50M
      expect(() => guard.verifyExpense(150000000)).toThrow('Budget limit exceeded');
    });
  });
});
