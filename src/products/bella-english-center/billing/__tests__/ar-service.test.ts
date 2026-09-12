/**
 * English Center Billing Service — Unit Tests (Mocked Engine)
 * 
 * Verifies English Center billing orchestration logic without hitting real Platform Finance.
 */

import { EnglishCenterBillingService } from '../ar-service';
import type { IF3AccountsReceivable, InvoiceResult, InvoiceView } from '@/platform/finance';

describe('EnglishCenterBillingService', () => {
  let service: EnglishCenterBillingService;
  let mockEngine: jest.Mocked<IF3AccountsReceivable>;

  beforeEach(() => {
    mockEngine = {
      createDraftInvoice: jest.fn(),
      addInvoiceLine: jest.fn(),
      finalizeInvoice: jest.fn(),
      voidInvoice: jest.fn(),
      getInvoice: jest.fn()
    };

    service = new EnglishCenterBillingService(mockEngine);
  });

  describe('createEnrollmentInvoice', () => {
    it('should create invoice with tuition + materials lines', async () => {
      mockEngine.createDraftInvoice.mockResolvedValue({
        invoiceId: 'inv-123',
        status: 'DRAFT',
        totalInvoiceAmountMinor: 0
      });

      mockEngine.addInvoiceLine.mockResolvedValue({
        invoiceId: 'inv-123',
        status: 'DRAFT',
        totalInvoiceAmountMinor: 5500000
      });

      mockEngine.finalizeInvoice.mockResolvedValue({
        invoiceId: 'inv-123',
        status: 'FINALIZED',
        totalInvoiceAmountMinor: 6050000,
        f1TransactionId: 'tx-456'
      });

      const result = await service.createEnrollmentInvoice({
        tenantId: 'tenant-1',
        enrollmentId: 'enr-001',
        studentPartyId: 'party-student-1',
        courseId: 'course-A',
        courseName: 'English Elementary A1',
        courseFeeMinor: 5000000,
        materialsFeeMinor: 500000,
        taxRate: 0.1,
        startDate: '2026-09-01',
        paymentDueDate: '2026-09-15'
      });

      // Verify createDraftInvoice called with correct mapping
      expect(mockEngine.createDraftInvoice).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        partyId: 'party-student-1',
        invoiceNumber: 'ENR-enr-001',
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-15'
      });

      // Verify 2 lines added (tuition + materials)
      expect(mockEngine.addInvoiceLine).toHaveBeenCalledTimes(2);

      // Verify tuition line
      expect(mockEngine.addInvoiceLine).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-123',
        description: 'Tuition - English Elementary A1',
        quantity: 1,
        unitPriceMinor: 5000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });

      // Verify materials line
      expect(mockEngine.addInvoiceLine).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-123',
        description: 'Course Materials',
        quantity: 1,
        unitPriceMinor: 500000,
        taxRate: 0.1,
        revenueAccountCode: '5112'
      });

      // Verify finalize called
      expect(mockEngine.finalizeInvoice).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-123'
      });

      // Verify result
      expect(result.status).toBe('FINALIZED');
      expect(result.f1TransactionId).toBe('tx-456');
    });

    it('should create invoice with tuition only (no materials)', async () => {
      mockEngine.createDraftInvoice.mockResolvedValue({
        invoiceId: 'inv-124',
        status: 'DRAFT',
        totalInvoiceAmountMinor: 0
      });

      mockEngine.finalizeInvoice.mockResolvedValue({
        invoiceId: 'inv-124',
        status: 'FINALIZED',
        totalInvoiceAmountMinor: 3300000,
        f1TransactionId: 'tx-457'
      });

      await service.createEnrollmentInvoice({
        tenantId: 'tenant-1',
        enrollmentId: 'enr-002',
        studentPartyId: 'party-student-2',
        courseId: 'course-B',
        courseName: 'Business English',
        courseFeeMinor: 3000000,
        materialsFeeMinor: 0,  // No materials
        taxRate: 0.1,
        startDate: '2026-09-01',
        paymentDueDate: '2026-09-30'
      });

      // Verify only 1 line added (tuition)
      expect(mockEngine.addInvoiceLine).toHaveBeenCalledTimes(1);
      expect(mockEngine.addInvoiceLine).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-124',
        description: 'Tuition - Business English',
        quantity: 1,
        unitPriceMinor: 3000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });
    });

    it('should propagate partyId correctly (NOT customer_id)', async () => {
      mockEngine.createDraftInvoice.mockResolvedValue({
        invoiceId: 'inv-125',
        status: 'DRAFT',
        totalInvoiceAmountMinor: 0
      });

      mockEngine.finalizeInvoice.mockResolvedValue({
        invoiceId: 'inv-125',
        status: 'FINALIZED',
        totalInvoiceAmountMinor: 2200000,
        f1TransactionId: 'tx-458'
      });

      await service.createEnrollmentInvoice({
        tenantId: 'tenant-1',
        enrollmentId: 'enr-003',
        studentPartyId: 'party-xyz',  // ← Party-native identity
        courseId: 'course-C',
        courseName: 'IELTS Prep',
        courseFeeMinor: 2000000,
        taxRate: 0.1,
        startDate: '2026-09-10',
        paymentDueDate: '2026-09-25'
      });

      const createCall = mockEngine.createDraftInvoice.mock.calls[0][0];
      expect(createCall.partyId).toBe('party-xyz');
      expect((createCall as any).customer_id).toBeUndefined();
    });
  });

  describe('getEnrollmentInvoice', () => {
    it('should retrieve invoice view', async () => {
      const mockView: InvoiceView = {
        header: {
          id: 'inv-123',
          tenantId: 'tenant-1',
          partyId: 'party-student-1',
          invoiceNumber: 'ENR-enr-001',
          status: 'FINALIZED',
          issueDate: '2026-09-01',
          dueDate: '2026-09-15',
          currency: 'VND',
          totalPretaxAmountMinor: 5500000,
          taxAmountMinor: 550000,
          totalInvoiceAmountMinor: 6050000,
          f1TransactionId: 'tx-456',
          postingStatus: 'SUCCESS',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        },
        lines: [
          {
            id: 'line-1',
            invoiceId: 'inv-123',
            description: 'Tuition - English Elementary A1',
            quantity: 1,
            unitPriceMinor: 5000000,
            taxRate: 0.1,
            amountMinor: 5000000,
            revenueAccountCode: '5111',
            createdAt: '2026-09-01T00:00:00Z'
          },
          {
            id: 'line-2',
            invoiceId: 'inv-123',
            description: 'Course Materials',
            quantity: 1,
            unitPriceMinor: 500000,
            taxRate: 0.1,
            amountMinor: 500000,
            revenueAccountCode: '5112',
            createdAt: '2026-09-01T00:00:00Z'
          }
        ],
        position: {
          invoiceId: 'inv-123',
          partyId: 'party-student-1',
          currency: 'VND',
          originalAmountMinor: 6050000,
          allocatedAmountMinor: 0,
          adjustedAmountMinor: 0,
          outstandingAmountMinor: 6050000,
          version: 1
        }
      };

      mockEngine.getInvoice.mockResolvedValue(mockView);

      const result = await service.getEnrollmentInvoice('tenant-1', 'inv-123');

      expect(mockEngine.getInvoice).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-123'
      });

      expect(result.header.partyId).toBe('party-student-1');
      expect(result.lines).toHaveLength(2);
      expect(result.position?.outstandingAmountMinor).toBe(6050000);
    });
  });

  describe('voidEnrollmentInvoice', () => {
    it('should void invoice', async () => {
      mockEngine.voidInvoice.mockResolvedValue({
        invoiceId: 'inv-123',
        status: 'VOIDED',
        totalInvoiceAmountMinor: 6050000,
        f1ReversalTransactionId: 'tx-reversal-789'
      });

      const result = await service.voidEnrollmentInvoice('tenant-1', 'inv-123');

      expect(mockEngine.voidInvoice).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        invoiceId: 'inv-123'
      });

      expect(result.status).toBe('VOIDED');
      expect(result.f1ReversalTransactionId).toBe('tx-reversal-789');
    });
  });
});
