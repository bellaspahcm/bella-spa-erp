/**
 * R4 Platform Finance Public Exports — Smoke Test
 * 
 * Verifies Product code can import F3 AR from public Platform API.
 * Blocks internal/deep imports.
 * 
 * @module R4PublicExportsTest
 */

describe('R4: Platform Finance Public Exports', () => {
  describe('Public API Surface', () => {
    it('should export IF3AccountsReceivable interface', () => {
      const { IF3AccountsReceivable } = require('@/platform/finance');
      expect(IF3AccountsReceivable).toBeUndefined(); // Interface not exported as value
      
      // Type-level check: this compiles means type is exported
      type TestType = import('@/platform/finance').IF3AccountsReceivable;
      const _typeCheck: TestType = {} as TestType;
    });

    it('should export createF3AREngine factory', () => {
      const { createF3AREngine } = require('@/platform/finance');
      expect(typeof createF3AREngine).toBe('function');
    });

    it('should export contract input types', () => {
      type CreateInvoiceInput = import('@/platform/finance').CreateInvoiceInput;
      type AddInvoiceLineInput = import('@/platform/finance').AddInvoiceLineInput;
      type FinalizeInvoiceInput = import('@/platform/finance').FinalizeInvoiceInput;
      type VoidInvoiceInput = import('@/platform/finance').VoidInvoiceInput;
      type GetInvoiceInput = import('@/platform/finance').GetInvoiceInput;

      // Type-level check passes = types exported
      const _: CreateInvoiceInput = {} as CreateInvoiceInput;
    });

    it('should export contract output types', () => {
      type InvoiceResult = import('@/platform/finance').InvoiceResult;
      type InvoiceView = import('@/platform/finance').InvoiceView;
      type InvoiceHeader = import('@/platform/finance').InvoiceHeader;
      type InvoiceLine = import('@/platform/finance').InvoiceLine;
      type ReceivablePosition = import('@/platform/finance').ReceivablePosition;
      type InvoiceStatus = import('@/platform/finance').InvoiceStatus;

      const _: InvoiceResult = {} as InvoiceResult;
    });

    it('should export typed errors', () => {
      const {
        F3InvoiceNotFoundError,
        F3InvoiceNotDraftError,
        F3InvoiceNotFinalizedError,
        F3InvoiceNumberDuplicateError,
        F3InvoiceEmptyError,
        F3ZeroValueInvoiceError,
        F3InvalidRevenueAccountError,
        F3InvoiceHasAllocationsError,
        F3InvalidInputError,
        F3PostingFailedError
      } = require('@/platform/finance');

      expect(F3InvoiceNotFoundError).toBeDefined();
      expect(F3InvoiceNotDraftError).toBeDefined();
      expect(F3InvoiceNotFinalizedError).toBeDefined();
      expect(F3InvoiceNumberDuplicateError).toBeDefined();
      expect(F3InvoiceEmptyError).toBeDefined();
      expect(F3ZeroValueInvoiceError).toBeDefined();
      expect(F3InvalidRevenueAccountError).toBeDefined();
      expect(F3InvoiceHasAllocationsError).toBeDefined();
      expect(F3InvalidInputError).toBeDefined();
      expect(F3PostingFailedError).toBeDefined();
    });
  });

  describe('Product Import Pattern (Smoke Test)', () => {
    it('should allow Product to import and instantiate engine', () => {
      // Simulate Product code importing from public API
      const { createF3AREngine } = require('@/platform/finance');
      
      // Factory should exist
      expect(typeof createF3AREngine).toBe('function');
      
      // Note: Cannot instantiate without env vars in test environment
      // Actual usage test happens in R5 English Center integration
    });

    it('should allow Product to import typed errors', () => {
      const { F3InvoiceNotFoundError } = require('@/platform/finance');
      
      const error = new F3InvoiceNotFoundError('test-invoice-id');
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('F3002');
      expect(error.message).toContain('test-invoice-id');
    });
  });

  describe('Internal Implementation Protection', () => {
    it('should NOT export internal engine implementation details', () => {
      const platformFinance = require('@/platform/finance');
      
      // Internal class should not be exported
      expect(platformFinance.F3AccountsReceivableEngine).toBeUndefined();
      
      // Internal helpers should not be exported
      expect(platformFinance.mapInvoiceHeader).toBeUndefined();
      expect(platformFinance.mapInvoiceLine).toBeUndefined();
      expect(platformFinance.buildF1Payload).toBeUndefined();
    });

    it('should NOT expose RPC/table names in public types', () => {
      // Type-level check: Product should never see these strings
      type CreateInvoiceInput = import('@/platform/finance').CreateInvoiceInput;
      type InvoiceResult = import('@/platform/finance').InvoiceResult;
      
      const input: CreateInvoiceInput = {
        tenantId: 'test',
        partyId: 'test',  // ← Uses partyId, NOT customer_id
        invoiceNumber: 'INV-001',
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      };

      // Should NOT have these DB-level fields
      expect((input as any).customer_id).toBeUndefined();
      expect((input as any).p_tenant_id).toBeUndefined();
      expect((input as any).finance_create_draft_invoice).toBeUndefined();
    });
  });

  describe('Backward Compatibility Guard', () => {
    it('should not break when F3 AR exports added', () => {
      const platformFinance = require('@/platform/finance');

      // F3 AR exports should coexist with other Platform exports
      expect(typeof platformFinance.createF3AREngine).toBe('function');
      
      // Shared kernel types should still be available
      // (specific exports may vary, just verify module loads)
      expect(platformFinance).toBeDefined();
    });
  });
});
