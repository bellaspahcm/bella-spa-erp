/**
 * Accounting Outbox Integration & Background Worker Tests
 *
 * Verifies:
 *  1. Authorization & security of the cron api endpoint.
 *  2. Sequential processing of batches (fifos).
 *  3. Dynamic routing to specific bookkeeping handlers.
 *  4. Robust error capture and backoff state transitions (mark_outbox_failed).
 *  5. Mark outbox completed upon successful posting.
 */

// ── Setup environment variables BEFORE imports ──
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.CRON_SECRET = 'test-cron-secret-123';

// ── Mock Supabase Client ──
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockClient = {
  rpc: mockRpc,
  from: mockFrom,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

// ── Mock Bookkeeping Handlers ──
import { RevenueRecognitionService } from '@/services/revenue-recognition';
import { AccountingEngineService } from '@/services/accounting-engine';

jest.mock('@/services/revenue-recognition', () => ({
  RevenueRecognitionService: {
    handlePackageSale: jest.fn(),
    handleSessionDone: jest.fn(),
    handleExpenseRecorded: jest.fn(),
    handleSalaryPaid: jest.fn(),
    handleInventoryConsumed: jest.fn(),
    handleRefundIssued: jest.fn(),
  },
}));

jest.mock('@/services/accounting-engine', () => ({
  AccountingEngineService: {
    postJournalEntry: jest.fn(),
  },
}));

import { GET } from '@/app/api/cron/accounting-worker/route';
import { NextRequest } from 'next/server';

describe('Accounting Outbox Worker API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'session_logs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'session-id', status: 'completed' },
            error: null,
          }),
        };
      }

      if (table === 'accounting_outbox') {
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        };
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.CRON_SECRET = 'test-cron-secret-123';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Authentication Guards
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Authentication Guard', () => {
    it('returns 401 Unauthorized if Authorization header is missing', async () => {
      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
      });

      const response = await GET(req);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });

    it('returns 401 Unauthorized if Authorization token does not match CRON_SECRET', async () => {
      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-secret',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('proceeds if Authorization token matches CRON_SECRET', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null }); // claim_outbox_batch returns empty array

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.processed).toBe(0);
    });

    it('returns 500 and does not claim outbox when Supabase admin env is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Event Routing & Bookkeeping Handlers
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Batch Event Processing & Routing', () => {
    it('claims pending outbox events, routes them to correct handlers, and completes them', async () => {
      // Setup mocked queue batch
      const mockBatch = [
        {
          id: 'outbox-id-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-id-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Bán gói liệu trình mẹ bé',
            branchId: 'branch-1',
          },
          retry_count: 0,
        },
        {
          id: 'outbox-id-2',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SESSION_DONE',
          reference_id: 'ref-id-2',
          payload: {
            earnedRevenueAmount: 200000,
            deferredRevenueAmount: 150000,
            receivableAmount: 50000,
            commissionAmount: 50000,
            ktvId: 'ktv-id-1',
            branchId: 'branch-1',
            description: 'Hoàn thành ca trị liệu',
          },
          retry_count: 0,
        },
      ];

      // 1. claim_outbox_batch returns the batch
      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      // 2. handlePackageSale resolves to journal entry ID
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockResolvedValueOnce('journal-entry-1');
      // 3. mark_outbox_completed for first event resolves successfully
      mockRpc.mockResolvedValueOnce({ error: null });
      // 4. handleSessionDone resolves to journal entry ID
      (RevenueRecognitionService.handleSessionDone as jest.Mock).mockResolvedValueOnce('journal-entry-2');
      // 5. mark_outbox_completed for second event resolves successfully
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.processed).toBe(2);
      expect(json.successCount).toBe(2);
      expect(json.failureCount).toBe(0);

      // Verify RPC claim call
      expect(mockRpc).toHaveBeenNthCalledWith(1, 'claim_outbox_batch', { p_limit: 50 });

      // Verify routing arguments
      expect(RevenueRecognitionService.handlePackageSale).toHaveBeenCalledWith({
        tenantId: 'tenant-uuid-1',
        packageSaleId: 'ref-id-1',
        totalAmount: 1000000,
        vatRate: 0,
        description: 'Bán gói liệu trình mẹ bé',
        branchId: 'branch-1',
      });

      expect(RevenueRecognitionService.handleSessionDone).toHaveBeenCalledWith({
        tenantId: 'tenant-uuid-1',
        sessionLogId: 'ref-id-2',
        earnedRevenueAmount: 200000,
        deferredRevenueAmount: 150000,
        receivableAmount: 50000,
        commissionAmount: 50000,
        ktvId: 'ktv-id-1',
        branchId: 'branch-1',
        description: 'Hoàn thành ca trị liệu',
      });

      // Verify completion updates in DB
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
        p_outbox_id: 'outbox-id-1',
        p_journal_entry_id: 'journal-entry-1',
      });
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
        p_outbox_id: 'outbox-id-2',
        p_journal_entry_id: 'journal-entry-2',
      });
    });

    it('dead-letters stale SESSION_DONE events when the source session is no longer completed', async () => {
      const outboxUpdate = jest.fn().mockReturnThis();
      const outboxEq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'session_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'ref-stale-session', status: 'scheduled' },
              error: null,
            }),
          };
        }

        if (table === 'accounting_outbox') {
          return {
            update: outboxUpdate,
            eq: outboxEq,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      });

      mockRpc.mockResolvedValueOnce({
        data: [{
          id: 'outbox-stale-session',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SESSION_DONE',
          reference_id: 'ref-stale-session',
          payload: {
            earnedRevenueAmount: 180000,
            commissionAmount: 150000,
            ktvId: 'ktv-id-1',
            description: 'Stale completed session',
          },
          retry_count: 0,
        }],
        error: null,
      });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.successCount).toBe(0);
      expect(json.deadLetterCount).toBe(1);
      expect(json.failureCount).toBe(0);
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-stale-session',
          status: 'dead_lettered',
          error: expect.stringContaining('not completed'),
        }),
      ]);
      expect(RevenueRecognitionService.handleSessionDone).not.toHaveBeenCalled();
      expect(outboxUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'DEAD',
        last_error: expect.stringContaining('not completed'),
      }));
      expect(outboxEq).toHaveBeenCalledWith('id', 'outbox-stale-session');
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_failed', expect.anything());
    });

    it('handles other event types: EXPENSE_RECORDED, SALARY_PAID, INVENTORY_CONSUMED, REFUND_ISSUED', async () => {
      const mockBatch = [
        {
          id: 'outbox-id-3',
          tenant_id: 'tenant-uuid-1',
          event_type: 'EXPENSE_RECORDED',
          reference_id: 'ref-id-3',
          payload: { amount: 500000, category: 'rent', paymentMethod: 'bank_transfer', description: 'Thuê mặt bằng' },
        },
        {
          id: 'outbox-id-4',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SALARY_PAID',
          reference_id: 'ref-id-4',
          payload: { amount: 8000000, paymentMethod: 'bank_transfer', description: 'Trả lương KTV', ktvId: 'ktv-1' },
        },
        {
          id: 'outbox-id-5',
          tenant_id: 'tenant-uuid-1',
          event_type: 'INVENTORY_CONSUMED',
          reference_id: 'ref-id-5',
          payload: { amount: 150000, description: 'Tiêu hao vật tư' },
        },
        {
          id: 'outbox-id-6',
          tenant_id: 'tenant-uuid-1',
          event_type: 'REFUND_ISSUED',
          reference_id: 'ref-id-6',
          payload: {
            amount: 300000,
            deferredRefundAmount: 120000,
            revenueReductionAmount: 180000,
            paymentMethod: 'cash',
            description: 'Hoàn tiền khách',
          },
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handleExpenseRecorded as jest.Mock).mockResolvedValueOnce('je-3');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleSalaryPaid as jest.Mock).mockResolvedValueOnce('je-4');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleInventoryConsumed as jest.Mock).mockResolvedValueOnce('je-5');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleRefundIssued as jest.Mock).mockResolvedValueOnce('je-6');
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.successCount).toBe(4);

      expect(RevenueRecognitionService.handleExpenseRecorded).toHaveBeenCalledWith(expect.objectContaining({ expenseId: 'ref-id-3' }));
      expect(RevenueRecognitionService.handleSalaryPaid).toHaveBeenCalledWith(expect.objectContaining({ salaryRecordId: 'ref-id-4' }));
      expect(RevenueRecognitionService.handleInventoryConsumed).toHaveBeenCalledWith(expect.objectContaining({ sessionLogId: 'ref-id-5' }));
      expect(RevenueRecognitionService.handleRefundIssued).toHaveBeenCalledWith(expect.objectContaining({
        refundId: 'ref-id-6',
        amount: 300000,
        deferredRefundAmount: 120000,
        revenueReductionAmount: 180000,
        paymentMethod: 'cash',
      }));
    });

    it('posts manual journal entries and marks the outbox completed with the journal id', async () => {
      const mockBatch = [
        {
          id: 'outbox-manual-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'MANUAL_ENTRY',
          reference_id: 'manual-ref-1',
          payload: {
            description: 'Manual adjustment',
            lines: [
              { account_id: 'acc-debit', debit_amount: 100000, credit_amount: 0, branch_id: 'branch-1' },
              { account_id: 'acc-credit', debit_amount: 0, credit_amount: 100000, branch_id: 'branch-1' },
            ],
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (AccountingEngineService.postJournalEntry as jest.Mock).mockResolvedValueOnce('journal-manual-1');
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.successCount).toBe(1);
      expect(AccountingEngineService.postJournalEntry).toHaveBeenCalledWith({
        tenant_id: 'tenant-uuid-1',
        description: 'Manual adjustment',
        reference_type: 'MANUAL',
        reference_id: 'manual-ref-1',
        lines: [
          { account_id: 'acc-debit', debit_amount: 100000, credit_amount: 0, branch_id: 'branch-1' },
          { account_id: 'acc-credit', debit_amount: 0, credit_amount: 100000, branch_id: 'branch-1' },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
        p_outbox_id: 'outbox-manual-1',
        p_journal_entry_id: 'journal-manual-1',
      });
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-manual-1',
          status: 'completed',
          journalEntryId: 'journal-manual-1',
        }),
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Error Handling & Backoff Retries
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Error Handling & Backoff Retries', () => {
    it('captures processing errors, increments retry count, and calls mark_outbox_failed', async () => {
      const mockBatch = [
        {
          id: 'outbox-fail-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-fail-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Failed sale',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      // Mock the recognition handler to fail/throw
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockRejectedValueOnce(new Error('Mất kết nối tài khoản COA'));
      mockRpc.mockResolvedValueOnce({ error: null }); // mark_outbox_failed resolves

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);

      // Verify mark_outbox_failed RPC call was invoked with the exact error message
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-fail-1',
        p_error: 'Mất kết nối tài khoản COA',
      });
    });

    it('fails malformed payloads instead of silently completing the outbox item', async () => {
      const mockBatch = [
        {
          id: 'outbox-invalid-payload-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-invalid-1',
          payload: {
            vatRate: 0,
            description: 'Missing amount sale',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('partial_failure');
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);

      expect(RevenueRecognitionService.handlePackageSale).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-invalid-payload-1',
        p_error: 'Invalid outbox payload: totalAmount must be a number.',
      });
    });

    it('reports critical failure details when mark_outbox_failed fails', async () => {
      const mockBatch = [
        {
          id: 'outbox-critical-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-critical-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Critical failed sale',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockRejectedValueOnce(new Error('COA unavailable'));
      mockRpc.mockResolvedValueOnce({ error: { message: 'failed-state write unavailable' } });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('critical_failure');
      expect(json.failureCount).toBe(1);
      expect(json.criticalFailureCount).toBe(1);
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-critical-1',
          eventType: 'PACKAGE_SALE',
          referenceId: 'ref-critical-1',
          status: 'critical_failed',
          error: 'COA unavailable',
          markFailedError: 'failed-state write unavailable',
        }),
      ]);
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-critical-1',
        p_error: 'COA unavailable',
      });
    });

    it('marks manual journal entry failures as failed without completing the outbox item', async () => {
      const mockBatch = [
        {
          id: 'outbox-manual-fail-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'MANUAL_ENTRY',
          reference_id: 'manual-ref-fail-1',
          payload: {
            description: 'Manual adjustment failure',
            lines: [
              { account_id: 'acc-debit', debit_amount: 100000, credit_amount: 0 },
              { account_id: 'acc-credit', debit_amount: 0, credit_amount: 100000 },
            ],
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (AccountingEngineService.postJournalEntry as jest.Mock).mockRejectedValueOnce(new Error('journal insert failed'));
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(false);
      expect(json.status).toBe('partial_failure');
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-manual-fail-1',
        p_error: 'journal insert failed',
      });
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-manual-fail-1',
          status: 'failed',
          error: 'journal insert failed',
        }),
      ]);
    });

    it('marks the event failed when mark_outbox_completed fails after handler success', async () => {
      const mockBatch = [
        {
          id: 'outbox-complete-fail-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-complete-fail-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Completion mark fails',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockResolvedValueOnce('journal-complete-fail');
      mockRpc.mockResolvedValueOnce({ error: { message: 'completed-state write unavailable' } });
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('partial_failure');
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);
      expect(json.criticalFailureCount).toBe(0);
      expect(mockRpc).toHaveBeenNthCalledWith(2, 'mark_outbox_completed', {
        p_outbox_id: 'outbox-complete-fail-1',
        p_journal_entry_id: 'journal-complete-fail',
      });
      expect(mockRpc).toHaveBeenNthCalledWith(3, 'mark_outbox_failed', {
        p_outbox_id: 'outbox-complete-fail-1',
        p_error: 'Failed to mark outbox completed: completed-state write unavailable',
      });
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-complete-fail-1',
          status: 'failed',
          error: 'Failed to mark outbox completed: completed-state write unavailable',
        }),
      ]);
    });

    it('completes a retry with an existing posted journal instead of posting a duplicate', async () => {
      const mockBatch = [
        {
          id: 'outbox-complete-fail-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-complete-fail-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Completion mark fails',
          },
          retry_count: 1,
        },
      ];
      const journalMaybeSingle = jest.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'journal-complete-fail', status: 'POSTED' },
          error: null,
        });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            maybeSingle: journalMaybeSingle,
          };
        }

        if (table === 'accounting_outbox') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          };
        }

        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockResolvedValueOnce('journal-complete-fail');
      mockRpc.mockResolvedValueOnce({ error: { message: 'completed-state write unavailable' } });
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const firstResponse = await GET(req);
      const firstJson = await firstResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(firstJson.success).toBe(false);
      expect(firstJson.failureCount).toBe(1);

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      mockRpc.mockResolvedValueOnce({ error: null });

      const secondResponse = await GET(req);
      const secondJson = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondJson.success).toBe(true);
      expect(secondJson.successCount).toBe(1);
      expect(secondJson.failureCount).toBe(0);
      expect(secondJson.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-complete-fail-1',
          status: 'completed',
          journalEntryId: 'journal-complete-fail',
        }),
      ]);
      expect(RevenueRecognitionService.handlePackageSale).toHaveBeenCalledTimes(1);
      expect(journalMaybeSingle).toHaveBeenCalledTimes(2);

      const completedCalls = mockRpc.mock.calls.filter(([fn]) => fn === 'mark_outbox_completed');
      expect(completedCalls).toHaveLength(2);
      expect(completedCalls[1]).toEqual([
        'mark_outbox_completed',
        {
          p_outbox_id: 'outbox-complete-fail-1',
          p_journal_entry_id: 'journal-complete-fail',
        },
      ]);
    });

    it('fails explicitly when a retry finds an existing active journal that is not posted', async () => {
      const mockBatch = [
        {
          id: 'outbox-existing-draft-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-existing-draft-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Existing draft journal',
          },
          retry_count: 1,
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'journal_entries') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'journal-draft-1', status: 'DRAFT' },
              error: null,
            }),
          };
        }

        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(false);
      expect(json.failureCount).toBe(1);
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-existing-draft-1',
          status: 'failed',
          error: expect.stringContaining('is DRAFT, not POSTED'),
        }),
      ]);
      expect(RevenueRecognitionService.handlePackageSale).not.toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-existing-draft-1',
        p_error: 'Existing active journal journal-draft-1 for PACKAGE_SALE:ref-existing-draft-1 is DRAFT, not POSTED.',
      });
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
    });

    it('continues processing mixed success and failure events with per-event details', async () => {
      const mockBatch = [
        {
          id: 'outbox-mixed-success',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-mixed-success',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Mixed success sale',
          },
          retry_count: 0,
        },
        {
          id: 'outbox-mixed-failure',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SESSION_DONE',
          reference_id: 'ref-mixed-failure',
          payload: {
            earnedRevenueAmount: 200000,
            commissionAmount: 50000,
            ktvId: 'ktv-id-1',
            description: 'Mixed failed session',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockResolvedValueOnce('journal-mixed-success');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleSessionDone as jest.Mock).mockRejectedValueOnce(new Error('session journal failed'));
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('partial_failure');
      expect(json.processed).toBe(2);
      expect(json.successCount).toBe(1);
      expect(json.failureCount).toBe(1);
      expect(json.criticalFailureCount).toBe(0);
      expect(json.details).toEqual([
        expect.objectContaining({
          eventId: 'outbox-mixed-success',
          status: 'completed',
          journalEntryId: 'journal-mixed-success',
        }),
        expect.objectContaining({
          eventId: 'outbox-mixed-failure',
          status: 'failed',
          error: 'session journal failed',
        }),
      ]);
      expect(RevenueRecognitionService.handleSessionDone).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-mixed-failure',
        p_error: 'session journal failed',
      });
    });
  });
});
