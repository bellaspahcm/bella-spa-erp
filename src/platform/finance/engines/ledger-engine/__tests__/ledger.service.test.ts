import { LedgerEngineService } from '../ledger.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostTransactionRequest } from '../../../contracts/ledger-engine.contract';
import type { Database } from '@/types/database.types';

describe('LedgerEngineService', () => {
  let mockSupabase: jest.Mocked<SupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn()
    } as any;
    ledgerService = new LedgerEngineService(mockSupabase);
  });

  describe('Document Date Provenance', () => {
    it('should include document_date in RPC payload and Request Hash', async () => {
      // 1. Arrange
      const postedAt = new Date('2026-08-30T10:00:00Z');
      const req: PostTransactionRequest = {
        tenant_id: 't1',
        idempotency_key: 'idemp-1',
        source_type: 'INVOICE',
        source_id: 'inv-1',
        transaction_type: 'ACCRUAL',
        posted_at: postedAt,
        transaction_currency: 'VND',
        functional_currency: 'VND',
        description: 'Test invoice',
        reference_type: 'INVOICE',
        reference_id: 'inv-1',
        document_date: '2026-08-25',
        lines: [
          { account_code: 'A/R', debit_amount_minor: '1000', credit_amount_minor: '0', memo: 'Dr AR' },
          { account_code: 'Rev', debit_amount_minor: '0', credit_amount_minor: '1000', memo: 'Cr Rev' }
        ]
      };

      // Mock RPC success
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          transaction_id: 'tx-1',
          status: 'POSTED',
          is_duplicate: false
        },
        error: null
      });

      // Mock transaction fetch success
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'tx-1',
          tenant_id: 't1',
          idempotency_key: 'idemp-1',
          source_type: 'INVOICE',
          source_id: 'inv-1',
          status: 'POSTED',
          transaction_type: 'ACCRUAL',
          accounting_period_id: 'period-1',
          posted_at: postedAt.toISOString(),
          transaction_currency: 'VND',
          functional_currency: 'VND',
          exchange_rate_rate: 1,
          exchange_rate_source: 'VND',
          exchange_rate_target: 'VND',
          exchange_rate_effective: postedAt.toISOString(),
          description: 'Test invoice',
          reference_type: 'INVOICE',
          reference_id: 'inv-1',
          document_date: '2026-08-25', // Should map back
          lines: []
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      } as any);

      // 2. Act
      const result = await ledgerService.postTransaction(req);

      // 3. Assert
      expect(result.success).toBe(true);
      expect(result.data?.document_date).toBe('2026-08-25');
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('finance_post_transaction', expect.objectContaining({
        p_document_date: '2026-08-25',
        p_request_hash: expect.any(String)
      }));
    });

    it('should generate different request hashes if document_date changes', async () => {
      // 1. Arrange
      const postedAt = new Date('2026-08-30T10:00:00Z');
      const baseReq: PostTransactionRequest = {
        tenant_id: 't1',
        idempotency_key: 'idemp-1',
        source_type: 'INVOICE',
        source_id: 'inv-1',
        transaction_type: 'ACCRUAL',
        posted_at: postedAt,
        transaction_currency: 'VND',
        functional_currency: 'VND',
        description: 'Test invoice',
        reference_type: 'INVOICE',
        reference_id: 'inv-1',
        lines: [
          { account_code: 'A/R', debit_amount_minor: '1000', credit_amount_minor: '0', memo: 'Dr AR' },
          { account_code: 'Rev', debit_amount_minor: '0', credit_amount_minor: '1000', memo: 'Cr Rev' }
        ]
      };

      const reqWithNullDate = { ...baseReq, document_date: undefined };
      const reqWithDateA = { ...baseReq, document_date: '2026-08-25' };
      const reqWithDateB = { ...baseReq, document_date: '2026-08-26' };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          success: true,
          transaction_id: 'tx-1',
          status: 'POSTED',
          is_duplicate: false
        },
        error: null
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'tx-1', lines: [] },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      } as any);

      // 2. Act
      await ledgerService.postTransaction(reqWithNullDate);
      const hashNull = mockSupabase.rpc.mock.calls[0][1].p_request_hash;

      await ledgerService.postTransaction(reqWithDateA);
      const hashA = mockSupabase.rpc.mock.calls[1][1].p_request_hash;

      await ledgerService.postTransaction(reqWithDateB);
      const hashB = mockSupabase.rpc.mock.calls[2][1].p_request_hash;

      // 3. Assert
      expect(hashNull).not.toEqual(hashA);
      expect(hashA).not.toEqual(hashB);
      expect(hashNull).not.toEqual(hashB);
    });
  });
});
