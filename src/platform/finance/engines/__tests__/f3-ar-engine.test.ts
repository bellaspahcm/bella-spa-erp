/**
 * F3 AR Engine Tests
 * 
 * Verifies engine wraps RPCs correctly and enforces Party semantics.
 */

import { F3AccountsReceivableEngine } from '../f3-ar-engine';
import {
  F3InvoiceNotFoundError,
  F3InvoiceNotDraftError,
  F3InvoiceNumberDuplicateError,
  F3InvalidInputError
} from '@/platform/finance/contracts/f3-ar.contract';

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase)
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('F3AccountsReceivableEngine', () => {
  let engine: F3AccountsReceivableEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new F3AccountsReceivableEngine('https://test.supabase.co', 'test-key');
  });

  // ========================================================================
  // CREATE DRAFT INVOICE
  // ========================================================================

  describe('createDraftInvoice', () => {
    it('should validate Party exists before creating invoice', async () => {
      // Mock Party validation: Party exists
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-1' },
        error: null
      });

      // Mock RPC call
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'invoice-123',
        error: null
      });

      const result = await engine.createDraftInvoice({
        tenantId: 'tenant-1',
        partyId: 'party-123',
        invoiceNumber: 'INV-001',
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      expect(result.invoiceId).toBe('invoice-123');
      expect(result.status).toBe('DRAFT');
      expect(result.totalInvoiceAmountMinor).toBe(0);

      // Verify Party validation called
      expect(mockSupabase.from).toHaveBeenCalledWith('party_parties');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'party-123');
    });

    it('should reject invalid Party (does not exist)', async () => {
      // Mock Party validation: Party NOT found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(
        engine.createDraftInvoice({
          tenantId: 'tenant-1',
          partyId: 'invalid-party',
          invoiceNumber: 'INV-001',
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should reject Party from wrong tenant', async () => {
      // Mock Party validation: Party exists but belongs to different tenant
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-2' },  // Wrong tenant
        error: null
      });

      await expect(
        engine.createDraftInvoice({
          tenantId: 'tenant-1',
          partyId: 'party-123',
          invoiceNumber: 'INV-001',
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should map partyId → customer_id in RPC call', async () => {
      // Mock Party validation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-1' },
        error: null
      });

      // Mock RPC call
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'invoice-123',
        error: null
      });

      await engine.createDraftInvoice({
        tenantId: 'tenant-1',
        partyId: 'party-123',
        invoiceNumber: 'INV-001',
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      // Verify RPC called with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('finance_create_draft_invoice', {
        p_tenant_id: 'tenant-1',
        p_customer_id: 'party-123',  // ← partyId mapped to customer_id
        p_invoice_number: 'INV-001',
        p_currency: 'VND',
        p_issue_date: '2026-09-01',
        p_due_date: '2026-09-30'
      });
    });

    it('should reject invalid dueDate (before issueDate)', async () => {
      // Mock Party validation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-1' },
        error: null
      });

      await expect(
        engine.createDraftInvoice({
          tenantId: 'tenant-1',
          partyId: 'party-123',
          invoiceNumber: 'INV-001',
          currency: 'VND',
          issueDate: '2026-09-30',
          dueDate: '2026-09-01'  // Invalid: before issue date
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should map duplicate invoice number error', async () => {
      // Mock Party validation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-1' },
        error: null
      });

      // Mock RPC error: duplicate invoice number
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uq_invoice_number_per_tenant"\nKey (tenant_id, invoice_number)=(tenant-1, INV-001) already exists.'
        }
      });

      await expect(
        engine.createDraftInvoice({
          tenantId: 'tenant-1',
          partyId: 'party-123',
          invoiceNumber: 'INV-001',
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvoiceNumberDuplicateError);
    });
  });

  // ========================================================================
  // ADD INVOICE LINE
  // ========================================================================

  describe('addInvoiceLine', () => {
    it('should validate quantity > 0', async () => {
      await expect(
        engine.addInvoiceLine({
          tenantId: 'tenant-1',
          invoiceId: 'invoice-123',
          description: 'Test',
          quantity: 0,  // Invalid
          unitPriceMinor: 1000,
          taxRate: 0.1,
          revenueAccountCode: '5111'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should validate unitPriceMinor >= 0', async () => {
      await expect(
        engine.addInvoiceLine({
          tenantId: 'tenant-1',
          invoiceId: 'invoice-123',
          description: 'Test',
          quantity: 1,
          unitPriceMinor: -100,  // Invalid
          taxRate: 0.1,
          revenueAccountCode: '5111'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should validate taxRate in range [0, 1]', async () => {
      await expect(
        engine.addInvoiceLine({
          tenantId: 'tenant-1',
          invoiceId: 'invoice-123',
          description: 'Test',
          quantity: 1,
          unitPriceMinor: 1000,
          taxRate: 1.5,  // Invalid: > 1
          revenueAccountCode: '5111'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should call RPC and return updated totals', async () => {
      // Mock RPC call
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'line-123',
        error: null
      });

      // Mock getInvoiceHeader (for updated totals)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'invoice-123',
          tenant_id: 'tenant-1',
          customer_id: 'party-123',
          invoice_number: 'INV-001',
          status: 'DRAFT',
          currency: 'VND',
          total_pretax_amount_minor: '500000',
          tax_amount_minor: '50000',
          total_invoice_amount_minor: '550000',
          issue_date: '2026-09-01',
          due_date: '2026-09-30',
          posting_status: 'PENDING',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z'
        },
        error: null
      });

      const result = await engine.addInvoiceLine({
        tenantId: 'tenant-1',
        invoiceId: 'invoice-123',
        description: 'Tuition Fee',
        quantity: 1,
        unitPriceMinor: 500000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });

      expect(result.invoiceId).toBe('invoice-123');
      expect(result.status).toBe('DRAFT');
      expect(result.totalInvoiceAmountMinor).toBe(550000);
    });
  });

  // ========================================================================
  // GET INVOICE
  // ========================================================================

  describe('getInvoice', () => {
    it('should map customer_id → partyId in header', async () => {
      // Mock invoice header
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'invoice-123',
                  tenant_id: 'tenant-1',
                  customer_id: 'party-123',  // ← DB stores customer_id
                  invoice_number: 'INV-001',
                  status: 'DRAFT',
                  currency: 'VND',
                  total_pretax_amount_minor: '0',
                  tax_amount_minor: '0',
                  total_invoice_amount_minor: '0',
                  issue_date: '2026-09-01',
                  due_date: '2026-09-30',
                  posting_status: 'PENDING',
                  created_at: '2026-09-01T00:00:00Z',
                  updated_at: '2026-09-01T00:00:00Z'
                },
                error: null
              })
            })
          })
        })
      });

      // Mock invoice lines
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      const view = await engine.getInvoice({
        tenantId: 'tenant-1',
        invoiceId: 'invoice-123'
      });

      // Verify partyId mapped correctly
      expect(view.header.partyId).toBe('party-123');  // ← Contract exposes partyId
      expect((view.header as any).customer_id).toBeUndefined();  // customer_id NOT exposed
    });

    it('should throw F3InvoiceNotFoundError if invoice does not exist', async () => {
      // Mock invoice not found
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      });

      await expect(
        engine.getInvoice({
          tenantId: 'tenant-1',
          invoiceId: 'nonexistent'
        })
      ).rejects.toThrow(F3InvoiceNotFoundError);
    });

    it('should include AR position if invoice is finalized', async () => {
      // Mock invoice header (FINALIZED)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'invoice-123',
                  tenant_id: 'tenant-1',
                  customer_id: 'party-123',
                  invoice_number: 'INV-001',
                  status: 'FINALIZED',
                  currency: 'VND',
                  total_pretax_amount_minor: '550000',
                  tax_amount_minor: '50000',
                  total_invoice_amount_minor: '550000',
                  issue_date: '2026-09-01',
                  due_date: '2026-09-30',
                  f1_transaction_id: 'tx-123',
                  posting_status: 'SUCCESS',
                  created_at: '2026-09-01T00:00:00Z',
                  updated_at: '2026-09-01T00:00:00Z'
                },
                error: null
              })
            })
          })
        })
      });

      // Mock invoice lines
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      // Mock AR position
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  invoice_id: 'invoice-123',
                  customer_id: 'party-123',
                  currency: 'VND',
                  original_amount_minor: '550000',
                  allocated_amount_minor: '0',
                  adjusted_amount_minor: '0',
                  outstanding_amount_minor: '550000',
                  version: 0
                },
                error: null
              })
            })
          })
        })
      });

      const view = await engine.getInvoice({
        tenantId: 'tenant-1',
        invoiceId: 'invoice-123'
      });

      expect(view.position).toBeDefined();
      expect(view.position?.partyId).toBe('party-123');
      expect(view.position?.outstandingAmountMinor).toBe(550000);
    });
  });

  // ========================================================================
  // ERROR MAPPING
  // ========================================================================

  describe('error mapping', () => {
    it('should map F3003 INVOICE_NOT_DRAFT error', async () => {
      // Mock Party validation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'party-123', tenant_id: 'tenant-1' },
        error: null
      });

      // Mock RPC error
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: 'F3003',
          message: 'Invoice invoice-123 is not DRAFT (current: FINALIZED)'
        }
      });

      try {
        await engine.addInvoiceLine({
          tenantId: 'tenant-1',
          invoiceId: 'invoice-123',
          description: 'Test',
          quantity: 1,
          unitPriceMinor: 1000,
          taxRate: 0.1,
          revenueAccountCode: '5111'
        });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(F3InvoiceNotDraftError);
        expect((err as F3InvoiceNotDraftError).code).toBe('F3003');
      }
    });
  });
});
